// Generated from runtime/alpha3/src/core/roleplay-tavern-source-inheritance-storage.ts; edit the TypeScript source.
/** Exact Source inheritance storage. Writes settle before the Source FIFO can
 * be released; an error after put is accepted only after exact actual readback. */
import { recordSha256, cloneRecord } from './roleplay-data.js';
import { types } from 'node:util';
import { inheritanceDataV1, inheritanceDataSha256V1, inheritanceFailV1, inheritanceSameV1, inheritanceObjectV1, inheritanceRefV1, sealInheritanceDataV1, validateStaticInventoryV1, validateNumericalCaptureV1, validateInheritanceRefV1, inheritanceIdV1, inheritanceHashV1, inheritanceExactV1, TAVERN_SOURCE_INHERITANCE_BOUNDS_V1 } from './roleplay-tavern-source-inheritance-data.js';
import { validateFrozenPromptScopeRecordV1, validateFrozenNonNumericalOpeningV1, tavernSourceFrozenPromptScopeKeyV1 } from './roleplay-tavern-source-inheritance-data.js';
import { validateTavernSourceProgramAbsenceOpeningRecordV1, validateFrozenProgramAbsenceOpeningV1, assertFrozenProgramAbsenceOpeningCutV1, tavernSourceProgramAbsenceOpeningKeyV1, validatePreparedInheritanceV1 } from './roleplay-tavern-source-inheritance-data.js';
import { tavernSourceOwnedRecordKeysV1, tavernSourcePreparedKeyV1, tavernSourceApplyKeyV1, tavernSourceCommitKeyV1, tavernSourceReadyKeyV1, tavernSourceEditBaselineKeyV1, tavernSourceMaterialBaselineKeyV1, tavernSourceMigrationKeyV1, tavernSourceEditSlotKeyV1, validateApplyInheritanceV1, validateCommitInheritanceV1, validateReadyInheritanceV1, validateTavernSourceLegacyMigrationRecordV1, validateTavernSourceMaterialBaselineV1 } from './roleplay-tavern-source-inheritance-data.js';
import { validateFrozenSourceEditBaselineV1, validateInheritanceEditSlotV1 } from './roleplay-tavern-source-edit-baseline.js';
import { cloneRoleplayTavernLoreImportRecordV1, TavernLoreDataFailureV1 } from './roleplay-tavern-lore-data.js';
import { validateProgramAbsenceOpeningClosureV1 } from './roleplay-program-absence-inheritance-data.js';
export function sourceReadBudgetV1() { return { refs: new Map() }; }
// These are cache ceilings, never new Source/Native admission limits. A miss
// always parses the same first actual row under its original limits/errors.
const NATIVE_DECODE_CACHE_V1 = Object.freeze({ addresses: 8, bytes: 33_554_432, nodes: 262_144, depth: 66 });
/** Compile only a successful parser's deeply frozen output. Sharing introduced
 * by that parser unfolds per occurrence; cycles and unsupported shapes miss.
 * Stats bound retention and compilation, not product admission or heap usage. */
function compileNativeDecodeV1(expected) {
    try {
        const active = new Set();
        let nodes = 0, bytes = 0, maximumDepth = 0;
        function unsupported() { throw new Error('Native decode plan unsupported'); }
        const charge = (size) => {
            bytes += size;
            if (bytes > NATIVE_DECODE_CACHE_V1.bytes)
                unsupported();
        };
        const text = (value) => {
            if (Buffer.byteLength(value, 'utf8') > NATIVE_DECODE_CACHE_V1.bytes - bytes)
                unsupported();
            charge(Buffer.byteLength(JSON.stringify(value), 'utf8'));
        };
        function visit(value, depth) {
            if (++nodes > NATIVE_DECODE_CACHE_V1.nodes || depth > NATIVE_DECODE_CACHE_V1.depth)
                unsupported();
            maximumDepth = Math.max(maximumDepth, depth);
            if (value === null || typeof value === 'boolean') {
                charge(value === null ? 4 : value ? 4 : 5);
                return Object.freeze({ kind: 'scalar', value });
            }
            if (typeof value === 'string') {
                if (!value.isWellFormed())
                    unsupported();
                text(value);
                return Object.freeze({ kind: 'scalar', value });
            }
            if (typeof value === 'number') {
                if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER || Object.is(value, -0))
                    unsupported();
                charge(Buffer.byteLength(JSON.stringify(value), 'utf8'));
                return Object.freeze({ kind: 'scalar', value });
            }
            if (typeof value !== 'object' || value === null || types.isProxy(value) || active.has(value) || !Object.isFrozen(value))
                unsupported();
            const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
            if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
                unsupported();
            const ownKeys = Reflect.ownKeys(value);
            if (ownKeys.length > NATIVE_DECODE_CACHE_V1.nodes - nodes + 1)
                unsupported();
            const keys = [], children = [];
            let length = 0;
            active.add(value);
            charge(2);
            try {
                for (const key of ownKeys) {
                    if (typeof key !== 'string' || key === '__proto__' || key === 'prototype' || key === 'constructor')
                        unsupported();
                    const descriptor = Object.getOwnPropertyDescriptor(value, key);
                    if (!descriptor || !Object.hasOwn(descriptor, 'value'))
                        unsupported();
                    keys.push(key);
                    if (array && key === 'length') {
                        if (descriptor.enumerable || !Number.isSafeInteger(descriptor.value) || descriptor.value < 0
                            || ownKeys.length !== descriptor.value + 1)
                            unsupported();
                        length = descriptor.value;
                        if (++nodes > NATIVE_DECODE_CACHE_V1.nodes)
                            unsupported();
                        continue;
                    }
                    if (!descriptor.enumerable)
                        unsupported();
                    if (array) {
                        if (key !== String(children.length))
                            unsupported();
                    }
                    else {
                        text(key);
                        charge(1);
                    }
                    if (children.length)
                        charge(1);
                    children.push(visit(descriptor.value, depth + 1));
                }
                if (array && keys[keys.length - 1] !== 'length')
                    unsupported();
                const fields = { keys: Object.freeze(keys), children: Object.freeze(children) };
                return array ? Object.freeze({ kind: 'array', length, ...fields }) : Object.freeze({ kind: 'record', ...fields });
            }
            finally {
                active.delete(value);
            }
        }
        const plan = visit(expected, 0);
        return Object.freeze({ plan, bytes, nodes, depth: maximumDepth });
    }
    catch {
        return undefined;
    }
}
/** Inspect every newly read raw occurrence. Strict scalar equality to the
 * compiled valid scalar already proves spelling/bytes; no string reencoding or
 * expected reflection is needed. Raw identity and hashes cannot grant a hit. */
function nativeDecodeMatchV1(raw, plan) {
    try {
        const seen = new Set();
        let nodes = 0;
        function visit(value, expected, depth) {
            if (++nodes > NATIVE_DECODE_CACHE_V1.nodes || depth > NATIVE_DECODE_CACHE_V1.depth)
                return false;
            if (expected.kind === 'scalar')
                return Object.is(value, expected.value);
            if (value === null || typeof value !== 'object' || types.isProxy(value) || seen.has(value))
                return false;
            seen.add(value);
            const array = expected.kind === 'array';
            if (Array.isArray(value) !== array)
                return false;
            const prototype = Object.getPrototypeOf(value);
            if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
                return false;
            const keys = Reflect.ownKeys(value);
            if (keys.length !== expected.keys.length)
                return false;
            for (let index = 0; index < keys.length; index++) {
                const key = expected.keys[index];
                if (keys[index] !== key)
                    return false;
                const descriptor = Object.getOwnPropertyDescriptor(value, key);
                if (!descriptor || !Object.hasOwn(descriptor, 'value'))
                    return false;
                if (expected.kind === 'array' && key === 'length') {
                    if (descriptor.enumerable || !Object.is(descriptor.value, expected.length))
                        return false;
                    if (++nodes > NATIVE_DECODE_CACHE_V1.nodes)
                        return false;
                }
                else {
                    if (!descriptor.enumerable || !visit(descriptor.value, expected.children[index], depth + 1))
                        return false;
                }
            }
            return true;
        }
        return visit(raw, plan, 0);
    }
    catch {
        // A comparison cannot replace the original parser's diagnosis.
        return false;
    }
}
/** This is readRow's lore-copy budget, not Native decode's cache statistics.
 * Each occurrence counts once; array length descriptors are not data nodes.
 * Only strict JSON spelling enters a plan. All other rows use the old copier. */
function compileReadonlyRowV1(expected) {
    try {
        if (types.isProxy(expected) || !Object.isFrozen(expected))
            return undefined;
        const prototype = Object.getPrototypeOf(expected), keys = Reflect.ownKeys(expected), fields = ['table', 'key', 'exists', 'sha256', 'value'];
        if (prototype !== Object.prototype && prototype !== null || keys.length !== fields.length
            || keys.some((key, index) => key !== fields[index]))
            return undefined;
        const metadata = fields.map(key => Object.getOwnPropertyDescriptor(expected, key));
        if (metadata.some(field => !field || !Object.hasOwn(field, 'value') || !field.enumerable))
            return undefined;
        const [table, key, exists, digest, value] = metadata.map(field => field.value);
        if (!['branch', 'cards', 'worldbook', 'rules', 'status', 'opening'].includes(table)
            || typeof key !== 'string' || !key.isWellFormed())
            return undefined;
        if (exists === false)
            return digest === 'missing' && value === null ? Object.freeze({ exists: false }) : undefined;
        if (exists !== true || !inheritanceHashV1(digest) || !inheritanceObjectV1(value))
            return undefined;
        const active = new Set();
        let bytes = 0, nodes = 0;
        function unsupported() { throw new Error('Source readonly row plan unsupported'); }
        const charge = (size) => {
            bytes += size;
            if (bytes > TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.bytes)
                unsupported();
        };
        const text = (input) => {
            if (!input.isWellFormed() || Buffer.byteLength(input, 'utf8') > TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.bytes - bytes)
                unsupported();
            charge(Buffer.byteLength(JSON.stringify(input), 'utf8'));
        };
        function visit(input, depth) {
            if (++nodes > TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.nodes || depth > TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.depth)
                unsupported();
            if (input === null || typeof input === 'boolean') {
                charge(input === null ? 4 : input ? 4 : 5);
                return Object.freeze({ kind: 'scalar', value: input });
            }
            if (typeof input === 'string') {
                text(input);
                return Object.freeze({ kind: 'scalar', value: input });
            }
            if (typeof input === 'number') {
                if (!Number.isFinite(input) || Math.abs(input) > Number.MAX_SAFE_INTEGER || Object.is(input, -0))
                    unsupported();
                charge(Buffer.byteLength(JSON.stringify(input), 'utf8'));
                return Object.freeze({ kind: 'scalar', value: input });
            }
            if (input === null || typeof input !== 'object' || types.isProxy(input) || active.has(input) || !Object.isFrozen(input))
                unsupported();
            const array = Array.isArray(input), prototype = Object.getPrototypeOf(input);
            if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null)
                unsupported();
            const ownKeys = Reflect.ownKeys(input);
            if (ownKeys.length > TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.nodes - nodes + 1)
                unsupported();
            const names = [], children = [];
            let length = 0;
            active.add(input);
            charge(2);
            try {
                for (const name of ownKeys) {
                    if (typeof name !== 'string' || name === '__proto__' || name === 'constructor' || name === 'prototype')
                        unsupported();
                    const descriptor = Object.getOwnPropertyDescriptor(input, name);
                    if (!descriptor || !Object.hasOwn(descriptor, 'value'))
                        unsupported();
                    names.push(name);
                    if (array && name === 'length') {
                        if (descriptor.enumerable || !Number.isSafeInteger(descriptor.value) || descriptor.value < 0
                            || descriptor.value > TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.nodes || ownKeys.length !== descriptor.value + 1)
                            unsupported();
                        length = descriptor.value;
                        continue;
                    }
                    if (!descriptor.enumerable)
                        unsupported();
                    if (array) {
                        if (name !== String(children.length))
                            unsupported();
                    }
                    else {
                        text(name);
                        charge(1);
                    }
                    if (children.length)
                        charge(1);
                    children.push(visit(descriptor.value, depth + 1));
                }
                if (array && names[names.length - 1] !== 'length')
                    unsupported();
                const fields = { keys: Object.freeze(names), children: Object.freeze(children) };
                return array ? Object.freeze({ kind: 'array', length, ...fields }) : Object.freeze({ kind: 'record', ...fields });
            }
            finally {
                active.delete(input);
            }
        }
        const plan = visit(value, 0);
        // collectOwnedRowFacts observes metadata and validated value with distinct
        // gets. Neither part alone can prove their combined expected row agrees.
        if (inheritanceDataSha256V1(value) !== digest)
            return undefined;
        return Object.freeze({ exists: true, value: plan });
    }
    catch {
        return undefined;
    }
}
/** A successful match proves the original independent lore clone fits and
 * yields equal JSON. Inspect every new raw occurrence; aliases do not reduce
 * budget charges. Proxy refusal always precedes reflection of that object. */
function matchesReadonlyRowValueV1(raw, plan) {
    try {
        const active = new Set();
        let nodes = 0;
        function visit(value, expected, depth) {
            if (++nodes > TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.nodes || depth > TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.depth)
                return false;
            if (expected.kind === 'scalar')
                return Object.is(value, expected.value);
            if (value === null || typeof value !== 'object' || types.isProxy(value) || active.has(value))
                return false;
            const array = expected.kind === 'array', prototype = Object.getPrototypeOf(value);
            if (Array.isArray(value) !== array || (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null))
                return false;
            const keys = Reflect.ownKeys(value);
            if (keys.length !== expected.keys.length)
                return false;
            active.add(value);
            try {
                for (let index = 0; index < keys.length; index++) {
                    const key = expected.keys[index];
                    if (keys[index] !== key)
                        return false;
                    const descriptor = Object.getOwnPropertyDescriptor(value, key);
                    if (!descriptor || !Object.hasOwn(descriptor, 'value'))
                        return false;
                    if (expected.kind === 'array' && key === 'length') {
                        if (descriptor.enumerable || !Object.is(descriptor.value, expected.length))
                            return false;
                    }
                    else if (!descriptor.enumerable || !visit(descriptor.value, expected.children[index], depth + 1))
                        return false;
                }
                return true;
            }
            finally {
                active.delete(value);
            }
        }
        return visit(raw, plan, 0);
    }
    catch {
        return false;
    }
}
export function createSourceInheritanceStorageV1(deps) {
    const tables = deps.tables;
    const nativeDecoded = new Map();
    let nativeDecodedBytes = 0, nativeDecodedNodes = 0;
    function forgetNativeDecoded(key) {
        const prior = nativeDecoded.get(key);
        if (!prior)
            return;
        nativeDecoded.delete(key);
        nativeDecodedBytes -= prior.bytes;
        nativeDecodedNodes -= prior.nodes;
    }
    function clearNativeDecoded() {
        nativeDecoded.clear();
        nativeDecodedBytes = 0;
        nativeDecodedNodes = 0;
    }
    function readOwnedShaV1(key, value) {
        const entry = nativeDecoded.get(key);
        if (!entry || entry.value !== value)
            return recordSha256(value);
        // Only this factory's still-retained qualified deep-frozen output is owned.
        // Its current raw was already fully compared before reaching this hash point.
        if (entry.pureDataSha === undefined)
            entry.pureDataSha = recordSha256(value);
        return entry.pureDataSha;
    }
    function observeReadV1(budget, key, value) {
        const sha256 = readOwnedShaV1(key, value), previous = budget.refs.get(key);
        if (previous) {
            if (previous.sha256 !== sha256)
                inheritanceFailV1('SOURCE_INHERITANCE_SOURCE_CHANGED', key);
            return previous.value;
        }
        budget.refs.set(key, { sha256, value });
        return value;
    }
    function decodeNative(key, kind, raw, parse) {
        const prior = nativeDecoded.get(key);
        if (prior && prior.kind === kind && nativeDecodeMatchV1(raw, prior.plan))
            return prior.value;
        forgetNativeDecoded(key);
        // Admission includes the archive key join in the original parse callback.
        const value = parse(), compiled = compileNativeDecodeV1(value);
        if (!compiled || !nativeDecodeMatchV1(raw, compiled.plan))
            return value;
        while (nativeDecoded.size >= NATIVE_DECODE_CACHE_V1.addresses
            || nativeDecodedBytes + compiled.bytes > NATIVE_DECODE_CACHE_V1.bytes
            || nativeDecodedNodes + compiled.nodes > NATIVE_DECODE_CACHE_V1.nodes) {
            const first = nativeDecoded.keys().next();
            if (first.done)
                return value;
            forgetNativeDecoded(first.value);
        }
        nativeDecoded.set(key, Object.seal({ kind, value, ...compiled, pureDataSha: undefined }));
        nativeDecodedBytes += compiled.bytes;
        nativeDecodedNodes += compiled.nodes;
        return value;
    }
    function rowFromRawV1(table, key, raw, budget) {
        const value = raw === undefined ? null : table === 'branch'
            ? readCurrentKey(key, raw, undefined, budget) : inheritanceDataV1(raw, budget);
        if (raw !== undefined && !inheritanceObjectV1(value))
            inheritanceFailV1('SOURCE_INHERITANCE_INVALID', `${table}:${key}`);
        return { table, key, exists: raw !== undefined, sha256: raw === undefined ? 'missing' : recordSha256(value),
            value: value };
    }
    function readRow(table, key, budget) {
        return rowFromRawV1(table, key, tables[table].get(key), budget);
    }
    /** Internal Source-owner consumer only. Its factory supplies its own final
     * frozen collected rows; no caller matcher/checked flag can assert a match.
     * Closure-local plans retain expected data only and do not outlive the frame. */
    function createReadonlyRowComparisonV1(expectedRows, validatedRows = []) {
        const ownedRows = new WeakSet(expectedRows), validated = new WeakSet(validatedRows), plans = new WeakMap(), nativePlans = new WeakMap();
        let nativePlanAddresses = 0, nativePlanBytes = 0, nativePlanNodes = 0;
        return (expected) => {
            const { table, key } = expected, raw = tables[table].get(key);
            // Actual I/O precedes optional lazy compilation. An unsupported plan or
            // failed probe cannot replace the old diagnosis or wash this first raw.
            let equal = false;
            if (ownedRows.has(expected)) {
                let plan = plans.get(expected);
                if (plan === undefined) {
                    plan = compileReadonlyRowV1(expected) ?? null;
                    plans.set(expected, plan);
                }
                equal = !!plan && (plan.exists ? matchesReadonlyRowValueV1(raw, plan.value) : raw === undefined);
            }
            if (!equal && (raw === undefined ? expected.exists : !expected.exists || recordSha256(raw) !== expected.sha256))
                return false;
            if (table !== 'branch' || !expected.exists || !validated.has(expected))
                return true;
            try {
                // Preserve the separate actual read. Only a complete strict match to
                // this factory's collected, already parsed value can skip pure decode.
                // Native's matcher rejects aliases and normalized -0/undefined spellings;
                // the ordinary readonly comparison alone cannot establish that match.
                const second = tables.branch.get(key);
                if (ownedRows.has(expected)) {
                    let plan = nativePlans.get(expected);
                    if (plan === undefined) {
                        const compiled = nativePlanAddresses < NATIVE_DECODE_CACHE_V1.addresses
                            ? compileNativeDecodeV1(expected.value) : undefined;
                        // These frame-local plans share the Native cache's retention
                        // ceilings. Exhaustion only disables reuse; the same second raw
                        // still goes through the original parser and admission limits.
                        plan = compiled && nativePlanBytes + compiled.bytes <= NATIVE_DECODE_CACHE_V1.bytes
                            && nativePlanNodes + compiled.nodes <= NATIVE_DECODE_CACHE_V1.nodes ? compiled.plan : null;
                        if (plan && compiled) {
                            nativePlanAddresses++;
                            nativePlanBytes += compiled.bytes;
                            nativePlanNodes += compiled.nodes;
                        }
                        nativePlans.set(expected, plan);
                    }
                    if (plan && nativeDecodeMatchV1(second, plan))
                        return true;
                }
                // Decode this same observed raw on every miss. A later good get must
                // never wash away a malformed or changed second result.
                return inheritanceDataSha256V1(readCurrentKey(key, second)) === expected.sha256;
            }
            catch (error) {
                clearNativeDecoded();
                throw error;
            }
        };
    }
    function inventory(sid) {
        if (!inheritanceIdV1(sid))
            inheritanceFailV1('SOURCE_INHERITANCE_INVALID');
        const rows = new Map(), prefix = `${sid}__`, budget = { bytes: 0, nodes: 0 };
        for (const table of ['cards', 'worldbook', 'rules', 'opening']) {
            for (const [key, value] of tables[table].entries()) {
                if (typeof key !== 'string')
                    inheritanceFailV1('SOURCE_INHERITANCE_INVALID');
                if (!key.startsWith(prefix))
                    continue;
                const row = readRow(table, key, budget);
                if (!row.exists || !inheritanceSameV1(row.value, value) || rows.has(`${table}:${key}`))
                    inheritanceFailV1('SOURCE_INHERITANCE_SOURCE_CHANGED', `${table}:${key}`);
                rows.set(`${table}:${key}`, row);
                if (rows.size > TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.rows)
                    inheritanceFailV1('SOURCE_INHERITANCE_BUDGET');
            }
        }
        for (const [table, suffix] of [['branch', 'settings'], ['rules', 'spec'], ['opening', 'scene'], ['status', 'spec']]) {
            const key = `${sid}__${suffix}`, previous = rows.get(`${table}:${key}`), row = readRow(table, key, previous ? undefined : budget);
            if (previous && !inheritanceSameV1(previous, row))
                inheritanceFailV1('SOURCE_INHERITANCE_SOURCE_CHANGED');
            rows.set(`${table}:${key}`, row);
        }
        const result = [...rows.values()].sort((a, b) => `${a.table}:${a.key}` < `${b.table}:${b.key}` ? -1 :
            `${a.table}:${a.key}` > `${b.table}:${b.key}` ? 1 : 0);
        validateStaticInventoryV1(result, sid);
        return result;
    }
    function readKey(key, budget) {
        try {
            return readCurrentKey(key, tables.branch.get(key), budget);
        }
        catch (error) {
            // Includes failed actual get, parser, key join and same-address observation.
            clearNativeDecoded();
            throw error;
        }
    }
    function maintainedRecordOwnerV1(key, raw) {
        const sid = key.slice(0, key.lastIndexOf('__'));
        if (inheritanceIdV1(sid) && tavernSourceOwnedRecordKeysV1(sid).has(key))
            return sid;
        if (inheritanceObjectV1(raw) && raw.encoding === 'native-tavern-source-edit-baseline-slot-v1'
            && inheritanceHashV1(raw.identitySha256) && key === tavernSourceEditSlotKeyV1(raw.identitySha256)) {
            return inheritanceObjectV1(raw.identity) && inheritanceIdV1(raw.identity.sessionId)
                ? raw.identity.sessionId : undefined;
        }
        return undefined;
    }
    /** Exact maintained address families share the same grammar for fresh
     * assembly and historical reads. An encoding or a prefix alone grants no
     * exemption from the independent raw-leaf reader. */
    function decodeMaintainedRecordV1(key, raw, owner) {
        let value;
        switch (key) {
            case tavernSourcePreparedKeyV1(owner):
                value = validatePreparedInheritanceV1(raw);
                break;
            case tavernSourceApplyKeyV1(owner):
                value = validateApplyInheritanceV1(raw);
                break;
            case tavernSourceCommitKeyV1(owner):
                value = validateCommitInheritanceV1(raw);
                break;
            case tavernSourceReadyKeyV1(owner):
                value = validateReadyInheritanceV1(raw);
                break;
            case tavernSourceEditBaselineKeyV1(owner):
                value = validateFrozenSourceEditBaselineV1(raw);
                break;
            case tavernSourceMaterialBaselineKeyV1(owner):
                value = validateTavernSourceMaterialBaselineV1(raw);
                break;
            case tavernSourceMigrationKeyV1(owner):
                value = validateTavernSourceLegacyMigrationRecordV1(raw);
                break;
            case tavernSourceFrozenPromptScopeKeyV1(owner):
                value = validateFrozenPromptScopeRecordV1(raw);
                break;
            case tavernSourceProgramAbsenceOpeningKeyV1(owner):
                value = validateTavernSourceProgramAbsenceOpeningRecordV1(raw);
                break;
            default:
                value = validateInheritanceEditSlotV1(raw);
                if (value.identity.sessionId !== owner)
                    inheritanceFailV1('SOURCE_INHERITANCE_INVALID', key);
                return value;
        }
        if (value.childSessionId !== owner)
            inheritanceFailV1('SOURCE_INHERITANCE_INVALID', key);
        return value;
    }
    function copyImportRecordV1(raw, budget) {
        try {
            return cloneRoleplayTavernLoreImportRecordV1(raw, TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.bytes, undefined, budget);
        }
        catch (error) {
            inheritanceFailV1(error instanceof TavernLoreDataFailureV1 && error.code === 'LORE_DATA_BUDGET'
                ? 'SOURCE_INHERITANCE_BUDGET' : 'SOURCE_INHERITANCE_INVALID');
        }
    }
    function readCurrentKey(key, raw, budget, leafBudget) {
        if (raw === undefined)
            inheritanceFailV1('SOURCE_INHERITANCE_MISSING', key);
        const owner = maintainedRecordOwnerV1(key, raw);
        // Domain tables return their shared immutable row. Detach once at this
        // storage observation before a family freezes it. structuredClone retains
        // Native's original -0/undefined spelling for its own strict decoder.
        let nativeEncoding, hasNativePrepared = false;
        if (raw !== null && typeof raw === 'object' && !types.isProxy(raw) && !Array.isArray(raw)) {
            const encoding = Object.getOwnPropertyDescriptor(raw, 'encoding');
            if (encoding && Object.hasOwn(encoding, 'value')) {
                nativeEncoding = encoding.value;
                if (nativeEncoding === 'native-tavern-source-inheritance-prepared-v1') {
                    const frozen = Object.getOwnPropertyDescriptor(raw, 'frozenProgramAbsenceOpeningV1');
                    hasNativePrepared = !!frozen && Object.hasOwn(frozen, 'value') && frozen.value !== undefined;
                }
            }
        }
        let actual;
        if (owner !== undefined && nativeEncoding === 'native-tavern-source-program-absence-opening-record-v1') {
            actual = decodeNative(key, 'archive', raw, () => decodeMaintainedRecordV1(key, cloneRecord(raw), owner));
        }
        else if (owner !== undefined && nativeEncoding === 'native-tavern-source-inheritance-prepared-v1' && hasNativePrepared) {
            actual = decodeNative(key, 'prepared', raw, () => decodeMaintainedRecordV1(key, cloneRecord(raw), owner));
        }
        else {
            forgetNativeDecoded(key);
            if (owner !== undefined)
                actual = decodeMaintainedRecordV1(key, cloneRecord(raw), owner);
            else if (inheritanceObjectV1(raw) && [4, 5].includes(Number(raw.schemaVersion))
                && inheritanceIdV1(raw.sessionId) && inheritanceIdV1(raw.importId)
                && key === `${raw.sessionId}__import-${raw.importId}`)
                actual = copyImportRecordV1(raw, leafBudget);
            else
                actual = inheritanceDataV1(raw, leafBudget);
        }
        return budget ? observeReadV1(budget, key, actual) : actual;
    }
    function readRef(ref, budget) {
        validateInheritanceRefV1(ref);
        const actual = readKey(ref.key, budget);
        if (readOwnedShaV1(ref.key, actual) !== ref.sha256)
            inheritanceFailV1('SOURCE_INHERITANCE_INVALID', ref.key);
        return actual;
    }
    async function putExact(table, key, value, prior = undefined) {
        // Source supplies admitted DATA. Domain owns its immutable stored rows;
        // comparing an actual observation neither retains nor freezes that row.
        const target = value, actual = tables[table].get(key);
        if (actual !== undefined && inheritanceSameV1(actual, target))
            return;
        if (!inheritanceSameV1(actual, prior))
            inheritanceFailV1('SOURCE_INHERITANCE_CHILD_CONFLICT', `${table}:${key}`);
        let failure;
        if (table === 'branch')
            forgetNativeDecoded(key);
        try {
            await tables[table].put(key, target);
        }
        catch (error) {
            failure = error;
        }
        // Await, then read: pending put promises cannot publish a ready marker.
        const readback = tables[table].get(key);
        if (!inheritanceSameV1(readback, target)) {
            inheritanceFailV1('SOURCE_INHERITANCE_WRITE_UNCONFIRMED', `${table}:${key}${failure ? ' (put rejected)' : ''}`);
        }
    }
    function native(sid) {
        const actual = deps.readNativeSession(sid);
        if (!actual || actual.id !== sid || actual.header.id !== undefined && actual.header.id !== sid)
            inheritanceFailV1('SOURCE_INHERITANCE_NATIVE_UNAVAILABLE', sid);
        const events = actual.snapshotEvents();
        if (events.some((event, index) => event.seq !== index))
            inheritanceFailV1('SOURCE_INHERITANCE_NATIVE_CHANGED', sid);
        return actual;
    }
    function numerical(sid, pointer, rows, captured) {
        if (!deps.readNumericalSourceCapture)
            inheritanceFailV1('SOURCE_INHERITANCE_NUMERICAL_CAPTURE_UNAVAILABLE');
        const statusSpec = rows.find(row => row.table === 'status' && row.key === `${sid}__spec`), openingScene = rows.find(row => row.table === 'opening' && row.key === `${sid}__scene`);
        let input, openingContext;
        if (captured) {
            const current = captured.source.current;
            openingContext = { context: current.openingContext.context, bindingSha256: current.openingContext.bindingSha256 };
            input = { sessionId: sid, pointer: captured.contributionInput.activePointer,
                imported: captured.contributionInput.activeImport,
                versions: { cards: current.cards, worldbook: current.worldbook, rules: current.rules, settings: current.settings },
                statusSpecSha256: statusSpec.sha256, openingSha256: openingScene.sha256,
                openingContextBindingSha256: openingContext.bindingSha256 };
        }
        else {
            // This actual supplier includes a raw table import, unlike Source's
            // admitted capture. Its owner borrows the original-file transport scalar
            // while the other independently read fields retain their leaf admission.
            const { imported: rawImported, ...metadata } = deps.readNumericalSourceCapture(sid);
            input = { ...inheritanceDataV1(metadata), imported: rawImported === undefined ? undefined : copyImportRecordV1(rawImported) };
            openingContext = inheritanceDataV1(deps.readOpeningContext(sid));
        }
        const imported = input.imported;
        if (!imported)
            inheritanceFailV1('SOURCE_INHERITANCE_NUMERICAL_CAPTURE_UNAVAILABLE');
        return validateNumericalCaptureV1(sealInheritanceDataV1({ schemaVersion: 1,
            encoding: 'native-tavern-numerical-source-capture-v1', inputSource: input, sessionId: sid, pointer,
            importIdentity: { importId: imported.importId, rawSha256: imported.rawSha256, normalizedSha256: imported.normalizedSha256,
                ...(imported.fieldProof === undefined ? {} : { fieldProof: imported.fieldProof }), activation: imported.activation },
            recordVersions: input.versions, statusSpec, openingScene, openingContext, staticRows: rows }, 'captureSha256'));
    }
    function original(source) {
        if (source.inheritance)
            return source.inheritance.originalBinding;
        const o = source.original, record = readRef({ key: o.importRecordRef.key, sha256: o.importRecordRef.sha256 });
        if (!inheritanceObjectV1(record) || !inheritanceObjectV1(record.activation))
            inheritanceFailV1('SOURCE_INHERITANCE_ORIGINAL_CHANGED');
        return { sourceRecordSessionId: source.sourceRecordSessionId, importId: o.activePointer.importId,
            rawSha256: o.rawSha256, normalizedSha256: o.normalizedSha256, coverageSha256: o.coverageSha256,
            transactionId: o.transactionId, normalizer: source.normalizer, documentSha256: o.documentSha256, dataSha256: o.dataSha256,
            importRecordRef: inheritanceRefV1(o.importRecordRef.key, record), activationSha256: recordSha256(record.activation),
            originalPointer: o.activePointer, originalPointerRef: { table: 'branch', key: o.activePointerRef.key, exists: true,
                sha256: recordSha256(o.activePointer) },
            ...(source.legacyInheritance ? { legacyCopy: source.legacyInheritance } : {}) };
    }
    function assertOriginal(binding, budget) {
        const record = readRef(binding.importRecordRef, budget);
        if (!inheritanceObjectV1(record) || record.sessionId !== binding.sourceRecordSessionId || record.importId !== binding.importId
            || record.rawSha256 !== binding.rawSha256 || record.normalizedSha256 !== binding.normalizedSha256
            || recordSha256(record.activation) !== binding.activationSha256)
            inheritanceFailV1('SOURCE_INHERITANCE_ORIGINAL_CHANGED');
    }
    function publications(raw) {
        if (!Array.isArray(raw) || raw.length > TAVERN_SOURCE_INHERITANCE_BOUNDS_V1.publications)
            inheritanceFailV1('SOURCE_INHERITANCE_BUDGET');
        const result = inheritanceDataV1(raw), seen = new Set();
        for (const pub of result) {
            inheritanceExactV1(pub, ['ownerSessionId', 'nativeSeq', 'nativeEventSha256', 'snapshotRef', 'planRef', 'nativeRecordSha256']);
            validateInheritanceRefV1(pub.snapshotRef);
            validateInheritanceRefV1(pub.planRef);
            if (!inheritanceIdV1(pub.ownerSessionId) || typeof pub.nativeSeq !== 'number' || !Number.isSafeInteger(pub.nativeSeq) || pub.nativeSeq < 0
                || !inheritanceHashV1(pub.nativeEventSha256) || !inheritanceHashV1(pub.nativeRecordSha256)
                || seen.has(`${pub.nativeSeq}`))
                inheritanceFailV1('SOURCE_INHERITANCE_MATERIAL_INVALID');
            seen.add(`${pub.nativeSeq}`);
        }
        // The Native-bound material reader owns the published snapshot/plan rows.
        // Source retains their references; re-admitting the derived layout here
        // applies raw Source limits to already admitted, repeated producer data.
        return result;
    }
    function writesFor(parent, child, rows) {
        const existing = inventory(child), parentKeys = new Set(rows.map(row => `${row.table}:${child}__${row.key.slice(parent.length + 2)}`));
        for (const row of existing)
            if (row.exists && !parentKeys.has(`${row.table}:${row.key}`))
                inheritanceFailV1('SOURCE_INHERITANCE_CHILD_CONFLICT', `${row.table}:${row.key}`);
        return rows.map(row => {
            const childKey = `${child}__${row.key.slice(parent.length + 2)}`, prior = readRow(row.table, childKey);
            const settings = row.table === 'branch' && row.key === `${parent}__settings`;
            if (prior.exists && !settings)
                inheritanceFailV1('SOURCE_INHERITANCE_CHILD_CONFLICT', `${row.table}:${childKey}`);
            if (row.value)
                for (const key of ['sessionId', 'ownerSessionId', 'branchId'])
                    if (row.value[key] !== undefined)
                        inheritanceFailV1('SOURCE_INHERITANCE_STATIC_OWNER_UNSUPPORTED', `${row.table}:${row.key}/${key}`);
            const value = settings && prior.exists ? { ...row.value, ...prior.value } : row.value, next = { table: row.table, key: childKey, exists: row.exists || settings && prior.exists,
                sha256: value === null ? 'missing' : recordSha256(value), value };
            return { table: row.table, parentKey: row.key, childKey, prior, next,
                policy: settings ? 'parent-settings-then-explicit-child-fields' : 'exact-static-copy' };
        });
    }
    async function freezeNonNumericalOpening(parent, child, cut, input) {
        if (input === undefined)
            return undefined;
        const captured = input;
        if (captured.kind === 'not-inherited') {
            if (cut.kind !== 'reserved-fresh-branch' || cut.seedLength !== 0)
                inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID');
            return validateFrozenNonNumericalOpeningV1(sealInheritanceDataV1(captured, 'frozenSha256'));
        }
        inheritanceExactV1(captured, ['schemaVersion', 'encoding', 'kind', 'frozenOpening', 'openingEventSpan']);
        inheritanceExactV1(captured.frozenOpening, ['ownerSessionId', 'intent', 'intentRef', 'nativeReceipt', 'scopeFacts', 'noNumericalInventory']);
        if (cut.kind !== 'native-fork' || captured.openingEventSpan.turnEndSeq >= cut.seedLength)
            inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID');
        const scope = validateFrozenPromptScopeRecordV1(sealInheritanceDataV1({ schemaVersion: 1,
            encoding: 'native-tavern-frozen-prompt-scope-record-v1', authority: 'consumer-data-only',
            childSessionId: child, parentSessionId: parent, scopeFacts: captured.frozenOpening.scopeFacts,
            scopeFactsSha256: recordSha256(captured.frozenOpening.scopeFacts) }, 'recordSha256')), scopeFactsRef = inheritanceRefV1(tavernSourceFrozenPromptScopeKeyV1(child), scope), packet = validateFrozenNonNumericalOpeningV1(sealInheritanceDataV1({ ...captured,
            frozenOpening: { ...captured.frozenOpening, scopeFactsRecord: scope, scopeFactsRef } }, 'frozenSha256'));
        // Validate the complete prospective datum first; then bind to a real row.
        // No circular reference to prepared and no checksum-only persisted proof.
        await putExact('branch', scopeFactsRef.key, scope);
        if (!inheritanceSameV1(readRef(scopeFactsRef), scope))
            inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID');
        return packet;
    }
    async function freezeProgramAbsenceOpening(parent, child, cut, input) {
        if (input === undefined)
            return undefined;
        const closure = validateProgramAbsenceOpeningClosureV1(input);
        if (cut.kind === 'reserved-fresh-branch' && cut.seedLength === 0) {
            return validateFrozenProgramAbsenceOpeningV1(sealInheritanceDataV1({ schemaVersion: 1,
                encoding: 'native-tavern-source-program-absence-opening-v1', kind: 'not-inherited', reason: 'fresh-cut-zero' }, 'frozenSha256'));
        }
        const record = validateTavernSourceProgramAbsenceOpeningRecordV1(sealInheritanceDataV1({ schemaVersion: 1,
            encoding: 'native-tavern-source-program-absence-opening-record-v1', authority: 'consumer-data-only',
            childSessionId: child, parentSessionId: parent, closure, closureSha256: closure.closureSha256 }, 'recordSha256')), recordRef = inheritanceRefV1(tavernSourceProgramAbsenceOpeningKeyV1(child), record), packet = validateFrozenProgramAbsenceOpeningV1(sealInheritanceDataV1({ schemaVersion: 1,
            encoding: 'native-tavern-source-program-absence-opening-v1', kind: 'program-absence', record, recordRef }, 'frozenSha256'));
        assertFrozenProgramAbsenceOpeningCutV1(packet, cut);
        // Archive first, then exact readback. Prepared is written by the caller
        // only after this await; a checksum never stands in for actual persistence.
        await putExact('branch', recordRef.key, record);
        if (!inheritanceSameV1(readRef(recordRef), record))
            inheritanceFailV1('SOURCE_INHERITANCE_OPENING_INVALID');
        return packet;
    }
    return { readRow, createReadonlyRowComparisonV1, inventory, readKey, readRef, putExact, native, numerical,
        original, assertOriginal, publications, writesFor,
        freezeNonNumericalOpening, freezeProgramAbsenceOpening };
}
