// Generated from runtime/alpha3/src/core/roleplay-mvu-lineage.ts; edit the TypeScript source.
/** Frozen static Source provenance for an actual Native fork. This is neither
 * a fresh-root initialization producer nor an activation of the child's rows.
 * Core owns the parent capture and child commit locks; every read is synchronous. */
import { recordSha256 } from './roleplay-data.js';
import { assertImportRecordIntegrity, importCoverage } from './roleplay-import-record.js';
export class MvuLineageRefusal extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
    }
}
const MAX_ROWS = 4096;
const MAX_BYTES = 1_048_576;
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const key = (value) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,256}$/.test(value);
const tables = ['branch', 'cards', 'worldbook', 'rules', 'status', 'opening'];
function fail(code) { throw new MvuLineageRefusal(code); }
const object = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const equal = (left, right) => recordSha256(left) === recordSha256(right);
/** Proofs and captured author rows have a finite JSON descriptor contract.
 * Reject accessors before hashing, including hidden/symbol properties and sparse
 * arrays; malformed evidence must never execute a getter or silently lose data. */
function inspectData(input, budget = { nodes: 0, bytes: 0 }) {
    const ancestors = new Set();
    function visit(value, depth) {
        if (++budget.nodes > 32_000 || depth > 32)
            fail('SOURCE_BUDGET');
        if (value === null || typeof value === 'boolean')
            return;
        if (typeof value === 'string') {
            budget.bytes += Buffer.byteLength(value, 'utf8');
            if (budget.bytes > MAX_BYTES)
                fail('SOURCE_BUDGET');
            return;
        }
        if (typeof value === 'number') {
            if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
                fail('SOURCE_INVALID');
            return;
        }
        if (!value || typeof value !== 'object' || ancestors.has(value))
            fail('SOURCE_INVALID');
        const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
        if ((array ? proto !== Array.prototype : ![Object.prototype, null].includes(proto))
            || Object.getOwnPropertySymbols(value).length)
            fail('SOURCE_INVALID');
        const descriptors = Object.getOwnPropertyDescriptors(value);
        if (array && (value.length > MAX_ROWS || Object.keys(descriptors).length !== value.length + 1))
            fail('SOURCE_BUDGET');
        ancestors.add(value);
        for (const [name, descriptor] of Object.entries(descriptors)) {
            if (array && name === 'length')
                continue;
            if (!('value' in descriptor) || !descriptor.enumerable
                || ['__proto__', 'constructor', 'prototype'].includes(name))
                fail('SOURCE_INVALID');
            if (array && (!/^(0|[1-9][0-9]*)$/.test(name) || Number(name) >= value.length))
                fail('SOURCE_INVALID');
            budget.bytes += Buffer.byteLength(name, 'utf8');
            if (budget.bytes > MAX_BYTES)
                fail('SOURCE_BUDGET');
            visit(descriptor.value, depth + 1);
        }
        ancestors.delete(value);
    }
    visit(input, 0);
}
function exact(value, required, optional = []) {
    if (!object(value) || required.some(name => !Object.hasOwn(value, name))
        || Object.keys(value).some(name => !required.includes(name) && !optional.includes(name)))
        fail('PROOF_INVALID');
}
function immutable(value) {
    if (value && typeof value === 'object') {
        for (const item of Object.values(value))
            immutable(item);
        Object.freeze(value);
    }
    return value;
}
const suffix = (rowKey, sessionId) => {
    if (!key(rowKey) || !rowKey.startsWith(`${sessionId}__`) || rowKey.length === sessionId.length + 2)
        fail('MATERIAL_INVALID');
    return rowKey.slice(sessionId.length + 2);
};
const rowIdentity = (row) => `${row.table}:${row.childKey}`;
/** Strict cold-read validation. A recomputed checksum cannot authorize missing
 * fields, new table kinds, duplicate mappings or invented activation digests. */
export function validateMvuDerivedSourceProof(input) {
    inspectData(input);
    exact(input, ['schemaVersion', 'encoding', 'parentSessionId', 'childSessionId', 'expectedSeedLength',
        'parentSourceSha256', 'childSourceSha256', 'parentPointerSha256', 'childPointerSha256',
        'originalImport', 'materialRows', 'macroContext', 'proofSha256']);
    if (input.schemaVersion !== 1 || input.encoding !== 'native-mvu-derived-source-proof-v1'
        || !id(input.parentSessionId) || !id(input.childSessionId) || input.parentSessionId === input.childSessionId
        || !Number.isSafeInteger(input.expectedSeedLength) || Number(input.expectedSeedLength) < 0
        || !['parentSourceSha256', 'childSourceSha256', 'parentPointerSha256', 'childPointerSha256', 'proofSha256']
            .every(name => hash(input[name])))
        fail('PROOF_INVALID');
    exact(input.originalImport, ['ownerSessionId', 'importId', 'rawSha256', 'normalizedSha256',
        'transactionId', 'coverageSha256', 'recordSha256', 'activationSha256']);
    const originalImport = input.originalImport;
    if (!['ownerSessionId', 'importId', 'transactionId'].every(name => id(originalImport[name]))
        || !['rawSha256', 'normalizedSha256', 'coverageSha256', 'recordSha256', 'activationSha256']
            .every(name => hash(originalImport[name])))
        fail('PROOF_INVALID');
    exact(input.macroContext, ['parentBindingSha256', 'childBindingSha256', 'valuesSha256']);
    if (!Object.values(input.macroContext).every(hash) || !Array.isArray(input.materialRows)
        || !input.materialRows.length || input.materialRows.length > MAX_ROWS)
        fail('PROOF_INVALID');
    let previous = '';
    for (const row of input.materialRows) {
        exact(row, ['table', 'parentKey', 'childKey', 'exists', 'sha256', 'activationSha256']);
        if (!tables.includes(row.table) || !key(row.parentKey) || !key(row.childKey)
            || typeof row.exists !== 'boolean' || (row.exists ? !hash(row.sha256) : row.sha256 !== 'missing')
            || (row.activationSha256 !== null && (!hash(row.activationSha256) || row.activationSha256 !== row.sha256)))
            fail('PROOF_INVALID');
        if (suffix(row.parentKey, input.parentSessionId) !== suffix(row.childKey, input.childSessionId))
            fail('PROOF_INVALID');
        const identity = `${row.table}:${row.childKey}`;
        if (identity <= previous)
            fail('PROOF_INVALID');
        previous = identity;
    }
    const { proofSha256, ...content } = input;
    if (recordSha256(content) !== proofSha256)
        fail('PROOF_INVALID');
    return immutable(structuredClone(input));
}
export function createRoleplayMvuLineage(deps) {
    function sessionReady(parentId, childId, seed) {
        const child = deps.readSession(childId);
        if (!child || child.id !== childId || child.header?.id !== childId || child.header.parentSession !== parentId
            || child.header.isSeeded !== true || child.inheritedEventCount !== seed) {
            fail('NATIVE_FORK_MISMATCH');
        }
        const meta = deps.tables.branch.get(`${childId}__meta`);
        inspectData(meta ?? null);
        if (!object(meta) || meta.inheritanceState !== 'ready' || meta.inheritedFrom !== parentId
            || meta.inheritedAtSeedLength !== seed)
            fail('INHERITANCE_UNREADY');
    }
    function pointer(sessionId) {
        const value = deps.tables.branch.get(deps.importActiveKey(sessionId));
        inspectData(value ?? null);
        exact(value, ['importId', 'normalizedSha256', 'transactionId', 'coverageSha256'], ['sourceRecordSessionId', 'activatedAt', 'inheritedFrom']);
        if (!id(value.importId) || !id(value.transactionId) || !hash(value.normalizedSha256) || !hash(value.coverageSha256)
            || (value.sourceRecordSessionId !== undefined && !id(value.sourceRecordSessionId))
            || (value.inheritedFrom !== undefined && !id(value.inheritedFrom))
            || (value.activatedAt !== undefined && (typeof value.activatedAt !== 'number' || value.activatedAt < 0)))
            fail('SOURCE_INVALID');
        return value;
    }
    function original(owner, importId) {
        const value = deps.tables.branch.get(deps.importRecordKey(owner, importId));
        inspectData(value ?? null);
        if (!object(value) || ![4, 5].includes(Number(value.schemaVersion)) || value.sessionId !== owner
            || value.importId !== importId || value.status !== 'active')
            fail('SOURCE_INVALID');
        const record = value;
        try {
            assertImportRecordIntegrity(record);
        }
        catch {
            fail('SOURCE_INVALID');
        }
        const coverage = importCoverage(record);
        if (coverage.coverage !== 1 || coverage.uncovered.length || coverage.overlaps.length
            || !hash(record.rawSha256) || !hash(record.normalizedSha256))
            fail('SOURCE_INVALID');
        const activation = record.activation;
        if (!activation || !id(activation.transactionId) || !Array.isArray(activation.writeDigests)
            || !activation.writeDigests.length || activation.writeDigests.length > MAX_ROWS)
            fail('ACTIVATION_INVALID');
        const seen = new Set();
        for (const digest of activation.writeDigests) {
            exact(digest, ['tableName', 'key', 'sha256']);
            if (!tables.includes(digest.tableName) || !hash(digest.sha256))
                fail('ACTIVATION_INVALID');
            suffix(digest.key, owner);
            const identity = `${digest.tableName}:${digest.key}`;
            if (seen.has(identity))
                fail('ACTIVATION_INVALID');
            seen.add(identity);
        }
        return { record, identity: { ownerSessionId: owner, importId, rawSha256: record.rawSha256,
                normalizedSha256: record.normalizedSha256, transactionId: activation.transactionId,
                coverageSha256: recordSha256(coverage), recordSha256: recordSha256(record), activationSha256: recordSha256(activation) } };
    }
    function context(sessionId) {
        const value = deps.readOpeningContext(sessionId);
        inspectData(value);
        exact(value, ['context', 'bindingSha256']);
        exact(value.context, [], ['user', 'char', 'user_gender']);
        if (!hash(value.bindingSha256) || Object.values(value.context).some(item => typeof item !== 'string' || item.length > 512)) {
            fail('MACRO_CONTEXT_INVALID');
        }
        return { bindingSha256: value.bindingSha256, valuesSha256: recordSha256(value.context) };
    }
    function inventory(sessionId) {
        const rows = new Map();
        const budget = { nodes: 0, bytes: 0 };
        function read(table, rowKey) {
            suffix(rowKey, sessionId);
            const value = deps.tables[table].get(rowKey);
            if (value !== undefined && !object(value))
                fail('MATERIAL_INVALID');
            inspectData(value ?? null, budget);
            rows.set(`${table}:${rowKey}`, { table, key: rowKey, exists: value !== undefined, sha256: recordSha256(value) });
            if (rows.size > MAX_ROWS)
                fail('SOURCE_BUDGET');
        }
        for (const table of ['cards', 'worldbook', 'rules', 'opening']) {
            for (const [rowKey] of deps.tables[table].entries())
                if (rowKey.startsWith(`${sessionId}__`))
                    read(table, rowKey);
        }
        for (const [table, sub] of [['branch', 'settings'], ['rules', 'spec'], ['status', 'spec'], ['opening', 'scene']]) {
            if (!rows.has(`${table}:${sessionId}__${sub}`))
                read(table, `${sessionId}__${sub}`);
        }
        return [...rows.values()].sort((a, b) => `${a.table}:${a.key}` < `${b.table}:${b.key}` ? -1 : 1);
    }
    function activationBindings(record, parentId, childId) {
        const result = new Map();
        for (const digest of record.activation.writeDigests) {
            const sub = suffix(digest.key, record.sessionId);
            const parentKey = `${parentId}__${sub}`, childKey = `${childId}__${sub}`;
            // Only author-owned static records can cross this boundary. Dynamic state,
            // branch provenance, import ledgers and input credentials are excluded.
            if ((digest.tableName === 'branch' && sub !== 'settings') || (digest.tableName === 'status' && sub !== 'spec')) {
                fail('ACTIVATION_SCOPE_UNSUPPORTED');
            }
            result.set(`${digest.tableName}:${childKey}`, digest.sha256);
            if (!key(parentKey) || !key(childKey))
                fail('MATERIAL_INVALID');
        }
        return result;
    }
    function capture(parentId, childId, expectedSeedLength) {
        if (!id(parentId) || !id(childId) || parentId === childId || !Number.isSafeInteger(expectedSeedLength)
            || expectedSeedLength < 0 || deps.readSession(parentId)?.id !== parentId)
            fail('REQUEST_INVALID');
        sessionReady(parentId, childId, expectedSeedLength);
        const parentPointer = pointer(parentId), childPointer = pointer(childId);
        const owner = (parentPointer.sourceRecordSessionId ?? parentId);
        const { record, identity } = original(owner, parentPointer.importId);
        if (parentPointer.normalizedSha256 !== identity.normalizedSha256 || parentPointer.transactionId !== identity.transactionId
            || parentPointer.coverageSha256 !== identity.coverageSha256 || !equal(childPointer, { ...parentPointer, inheritedFrom: parentId, sourceRecordSessionId: owner }))
            fail('SOURCE_MISMATCH');
        const parentRows = inventory(parentId), childRows = inventory(childId);
        if (parentRows.length !== childRows.length)
            fail('MATERIAL_MISMATCH');
        const activation = activationBindings(record, parentId, childId);
        const materialRows = parentRows.map((row, index) => {
            const child = childRows[index], childKey = `${childId}__${suffix(row.key, parentId)}`;
            if (row.table !== child.table || child.key !== childKey || row.exists !== child.exists || row.sha256 !== child.sha256) {
                fail('MATERIAL_MISMATCH');
            }
            const activationSha256 = activation.get(`${row.table}:${childKey}`) ?? null;
            if (activationSha256 !== null && (!row.exists || row.sha256 !== activationSha256))
                fail('ACTIVATION_MISMATCH');
            return { table: row.table, parentKey: row.key, childKey, exists: row.exists, sha256: row.sha256, activationSha256 };
        });
        if (materialRows.filter(row => row.activationSha256 !== null).length !== activation.size)
            fail('ACTIVATION_MISMATCH');
        const parentContext = context(parentId), childContext = context(childId);
        if (parentContext.valuesSha256 !== childContext.valuesSha256)
            fail('MACRO_CONTEXT_MISMATCH');
        const parentSourceSha256 = deps.readSourceSha256(parentId), childSourceSha256 = deps.readSourceSha256(childId);
        if (!hash(parentSourceSha256) || !hash(childSourceSha256))
            fail('SOURCE_INVALID');
        const content = { schemaVersion: 1, encoding: 'native-mvu-derived-source-proof-v1',
            parentSessionId: parentId, childSessionId: childId, expectedSeedLength, parentSourceSha256, childSourceSha256,
            parentPointerSha256: recordSha256(parentPointer), childPointerSha256: recordSha256(childPointer),
            originalImport: identity, materialRows, macroContext: { parentBindingSha256: parentContext.bindingSha256,
                childBindingSha256: childContext.bindingSha256, valuesSha256: childContext.valuesSha256 } };
        return validateMvuDerivedSourceProof({ ...content, proofSha256: recordSha256(content) });
    }
    /** Historical facts come from an actual retained Native read, never a header
     * reconstructed from a domain proof. Today's static rows belong to current;
     * original activation facts remain independently readable for both modes. */
    function validateHistorical(input) {
        const proof = validateMvuDerivedSourceProof(input), sid = proof.childSessionId;
        sessionReady(proof.parentSessionId, sid, proof.expectedSeedLength);
        const { record, identity } = original(proof.originalImport.ownerSessionId, proof.originalImport.importId);
        if (!equal(proof.originalImport, identity))
            fail('SOURCE_MISMATCH');
        const activation = activationBindings(record, proof.parentSessionId, sid);
        for (const row of proof.materialRows) {
            if ((activation.get(rowIdentity(row)) ?? null) !== row.activationSha256)
                fail('ACTIVATION_MISMATCH');
        }
        if (proof.materialRows.filter(row => row.activationSha256 !== null).length !== activation.size)
            fail('ACTIVATION_MISMATCH');
        return { proof, activation };
    }
    /** The caller first verifies the actual current descendant, then walks its
     * immutable basis chain backwards. A lone proof checksum cannot establish
     * historical material: every row must also be carried by that verified next
     * generation. This helper grants no Session or Native input authority. */
    function historical(input, successorInput) {
        try {
            const { proof } = validateHistorical(input), successor = validateMvuDerivedSourceProof(successorInput);
            if (successor.parentSessionId !== proof.childSessionId
                || successor.parentSourceSha256 !== proof.childSourceSha256
                || successor.parentPointerSha256 !== proof.childPointerSha256
                || successor.macroContext.parentBindingSha256 !== proof.macroContext.childBindingSha256
                || successor.macroContext.valuesSha256 !== proof.macroContext.valuesSha256
                || !equal(successor.originalImport, proof.originalImport)
                || successor.materialRows.length !== proof.materialRows.length)
                return false;
            const inherited = new Map(successor.materialRows.map(row => [`${row.table}:${row.parentKey}`, row]));
            return proof.materialRows.every(row => {
                const next = inherited.get(rowIdentity(row));
                return !!next && next.exists === row.exists && next.sha256 === row.sha256
                    && next.activationSha256 === row.activationSha256;
            });
        }
        catch {
            return false;
        }
    }
    function current(input) {
        try {
            const { proof, activation } = validateHistorical(input), sid = proof.childSessionId;
            const active = pointer(sid), identity = proof.originalImport;
            if (recordSha256(active) !== proof.childPointerSha256 || active.inheritedFrom !== proof.parentSessionId
                || active.sourceRecordSessionId !== identity.ownerSessionId || active.importId !== identity.importId
                || active.normalizedSha256 !== identity.normalizedSha256 || active.transactionId !== identity.transactionId
                || active.coverageSha256 !== identity.coverageSha256 || deps.readSourceSha256(sid) !== proof.childSourceSha256)
                return false;
            const rows = inventory(sid);
            if (rows.length !== proof.materialRows.length)
                return false;
            for (const [index, row] of rows.entries()) {
                const frozen = proof.materialRows[index];
                if (row.table !== frozen.table || row.key !== frozen.childKey || row.exists !== frozen.exists
                    || row.sha256 !== frozen.sha256 || (activation.get(rowIdentity(frozen)) ?? null) !== frozen.activationSha256)
                    return false;
            }
            if (proof.materialRows.filter(row => row.activationSha256 !== null).length !== activation.size)
                return false;
            const observedContext = context(sid);
            return observedContext.bindingSha256 === proof.macroContext.childBindingSha256
                && observedContext.valuesSha256 === proof.macroContext.valuesSha256;
        }
        catch {
            return false;
        }
    }
    /** Denial readers still need actual Native boundaries and original activation
     * facts. This does not certify today's static Source or grant story authority. */
    function verifyDenialBindingFacts(input) {
        try {
            validateHistorical(input);
            return true;
        }
        catch {
            return false;
        }
    }
    return { capture, current, historical, verifyDenialBindingFacts, validate: validateMvuDerivedSourceProof };
}
