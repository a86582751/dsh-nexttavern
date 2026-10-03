// Generated from runtime/alpha3/src/core/roleplay-mvu-frozen-lineage.ts; edit the TypeScript source.
/** Version two binds numerical inheritance to the actual immutable Source
 * transaction. Today's ancestor rows and mutable operation records are never
 * substituted for its captured copy or the descendant's real Native cut. */
import { recordSha256 } from './roleplay-data.js';
import { describeRoleplayInputSourceV1 } from './roleplay-input-source-data.js';
import { createRoleplayMvuLineage, validateMvuDerivedSourceProof } from './roleplay-mvu-lineage.js';
import { inheritanceDataV1, inheritanceExactV1, inheritanceHashV1, inheritanceIdV1, validateTavernSourceInheritanceDescriptorV1, validateNumericalCaptureV1, frozenInheritanceRefV1 } from './roleplay-tavern-source-inheritance-data.js';
export function validateMvuPreparedSourceRefV1(raw) {
    const ref = inheritanceDataV1(raw);
    inheritanceExactV1(ref, ['schemaVersion', 'encoding', 'childSessionId', 'parentSessionId', 'operationId',
        'anchorSha256', 'seedLength', 'prefixSha256', 'parentSourceSha256', 'parentInventorySha256',
        'originalIdentitySha256', 'preparedRef', 'frozenRefSha256']);
    inheritanceExactV1(ref.preparedRef, ['key', 'sha256']);
    if (ref.schemaVersion !== 1 || ref.encoding !== 'native-tavern-source-inheritance-frozen-ref-v1'
        || !['childSessionId', 'parentSessionId', 'operationId'].every(field => inheritanceIdV1(ref[field]))
        || ref.childSessionId === ref.parentSessionId || !Number.isSafeInteger(ref.seedLength) || Number(ref.seedLength) < 1
        || !['anchorSha256', 'prefixSha256', 'parentSourceSha256', 'parentInventorySha256', 'originalIdentitySha256', 'frozenRefSha256']
            .every(field => inheritanceHashV1(ref[field]))
        || ref.preparedRef.key !== `${ref.childSessionId}__tavern-source-prepared-v1`
        || !inheritanceHashV1(ref.preparedRef.sha256))
        fail();
    const { frozenRefSha256, ...body } = ref;
    if (recordSha256(body) !== frozenRefSha256)
        fail();
    return ref;
}
function fail(code = 'FROZEN_SOURCE_UNPROVEN') { throw Error(code); }
const same = (left, right) => recordSha256(left) === recordSha256(right);
const fields = ['schemaVersion', 'encoding', 'operationId', 'anchorSha256', 'parentSessionId', 'childSessionId',
    'expectedSeedLength', 'parentInheritedEventCount', 'parentSourceSha256', 'childSourceSha256', 'parentPointerSha256',
    'childPointerSha256', 'sourceInheritance', 'numericalProjection', 'originalImport', 'materialRows', 'macroContext', 'proofSha256'];
export function validateMvuFrozenDerivedSourceProofV2(raw) {
    const value = inheritanceDataV1(raw);
    inheritanceExactV1(value, fields);
    if (value.schemaVersion !== 2 || value.encoding !== 'native-mvu-derived-source-proof-v2'
        || !['operationId', 'parentSessionId', 'childSessionId'].every(key => inheritanceIdV1(value[key]))
        || value.parentSessionId === value.childSessionId
        || !Number.isSafeInteger(value.expectedSeedLength) || Number(value.expectedSeedLength) < 1
        || !Number.isSafeInteger(value.parentInheritedEventCount) || Number(value.parentInheritedEventCount) < 0
        || Number(value.parentInheritedEventCount) >= Number(value.expectedSeedLength)
        || !['anchorSha256', 'parentSourceSha256', 'childSourceSha256', 'parentPointerSha256', 'childPointerSha256', 'proofSha256']
            .every(key => inheritanceHashV1(value[key])))
        fail();
    const source = validateTavernSourceInheritanceDescriptorV1(value.sourceInheritance);
    if (source.nativeCut.kind !== 'native-fork' || source.operationId !== value.operationId
        || source.anchorSha256 !== value.anchorSha256 || source.parentSessionId !== value.parentSessionId
        || source.childSessionId !== value.childSessionId || source.nativeCut.seedLength !== value.expectedSeedLength
        || source.nativeCut.parentInheritedEventCount !== value.parentInheritedEventCount
        || source.childPointerAtCommitSha256 !== value.childPointerSha256)
        fail();
    inheritanceExactV1(value.numericalProjection, ['policy', 'parentCaptureSha256', 'childCaptureSha256', 'copyRelationPolicy']);
    if (value.numericalProjection.policy !== 'roleplay-input-source-observation-v1'
        || value.numericalProjection.copyRelationPolicy !== 'exact-static-copy-with-declared-owner-rebinding-v1'
        || !inheritanceHashV1(value.numericalProjection.parentCaptureSha256)
        || !inheritanceHashV1(value.numericalProjection.childCaptureSha256))
        fail();
    inheritanceExactV1(value.originalImport, ['ownerSessionId', 'importId', 'rawSha256', 'normalizedSha256',
        'transactionId', 'coverageSha256', 'recordSha256', 'activationSha256']);
    const originalImport = value.originalImport;
    if (!['ownerSessionId', 'importId', 'transactionId'].every(key => inheritanceIdV1(originalImport[key]))
        || !['rawSha256', 'normalizedSha256', 'coverageSha256', 'recordSha256', 'activationSha256']
            .every(key => inheritanceHashV1(originalImport[key])))
        fail();
    const original = source.originalBinding;
    if (value.originalImport.ownerSessionId !== original.sourceRecordSessionId || value.originalImport.importId !== original.importId
        || value.originalImport.rawSha256 !== original.rawSha256 || value.originalImport.normalizedSha256 !== original.normalizedSha256
        || value.originalImport.transactionId !== original.transactionId || value.originalImport.coverageSha256 !== original.coverageSha256
        || value.originalImport.recordSha256 !== original.importRecordRef.sha256
        || value.originalImport.activationSha256 !== original.activationSha256)
        fail();
    inheritanceExactV1(value.macroContext, ['parentBindingSha256', 'childBindingSha256', 'valuesSha256']);
    if (!Object.values(value.macroContext).every(inheritanceHashV1) || !Array.isArray(value.materialRows)
        || value.materialRows.length < 1 || value.materialRows.length > 4096)
        fail();
    let previous = '';
    for (const row of value.materialRows) {
        inheritanceExactV1(row, ['table', 'parentKey', 'childKey', 'exists', 'parentValueSha256', 'childValueSha256',
            'originalActivationKey', 'originalActivationSha256', 'mappingKind']);
        if (!['branch', 'cards', 'worldbook', 'rules', 'status', 'opening'].includes(String(row.table))
            || typeof row.parentKey !== 'string' || typeof row.childKey !== 'string'
            || !row.parentKey.startsWith(`${value.parentSessionId}__`)
            || row.childKey !== `${value.childSessionId}__${row.parentKey.slice(String(value.parentSessionId).length + 2)}`
            || typeof row.exists !== 'boolean' || row.mappingKind !== 'identity-copy'
            || (row.exists ? !inheritanceHashV1(row.parentValueSha256) || !inheritanceHashV1(row.childValueSha256)
                : row.parentValueSha256 !== 'missing' || row.childValueSha256 !== 'missing')
            || row.parentValueSha256 !== row.childValueSha256
            || (row.originalActivationKey === null) !== (row.originalActivationSha256 === null)
            || row.originalActivationKey !== null && (typeof row.originalActivationKey !== 'string'
                || !row.originalActivationKey.startsWith(`${value.originalImport.ownerSessionId}__`)
                || row.originalActivationSha256 !== 'missing' && !inheritanceHashV1(row.originalActivationSha256)))
            fail();
        const identity = `${row.table}:${row.childKey}`;
        if (identity <= previous)
            fail();
        previous = identity;
    }
    const { proofSha256, ...body } = value;
    if (recordSha256(body) !== proofSha256)
        fail();
    return value;
}
export function validateMvuDerivedSourceProofUnion(raw) {
    const value = inheritanceDataV1(raw);
    return value.schemaVersion === 2 ? validateMvuFrozenDerivedSourceProofV2(value) : validateMvuDerivedSourceProof(value);
}
const descriptor = (raw) => describeRoleplayInputSourceV1(validateNumericalCaptureV1(raw).inputSource);
export function createRoleplayMvuFrozenLineage(deps) {
    const old = createRoleplayMvuLineage(deps);
    const owner = () => { const current = deps.sourceInheritance(); if (!current)
        fail('FROZEN_SOURCE_OWNER_UNAVAILABLE'); return current; };
    function prepared(childId) {
        const frozen = owner().readPreparedSourceInheritance(childId), ref = frozenInheritanceRefV1(frozen), parentDescriptor = descriptor(frozen.parentNumericalSource);
        if (frozen.nativeCut.kind !== 'native-fork')
            fail('FROZEN_SOURCE_NATIVE_FORK_REQUIRED');
        return { frozen, ref, parentDescriptor, parentSourceSha256: recordSha256(parentDescriptor) };
    }
    function capture(childId, sourcePreparedRef) {
        const current = owner().readCommittedStaticSourceInheritance(childId), { prepared: parent, commit, inheritance } = current, frozen = prepared(childId);
        if (!same(frozen.ref, sourcePreparedRef) || !same(inheritance.preparedRef, sourcePreparedRef.preparedRef))
            fail('FROZEN_SOURCE_PREPARED_CHANGED');
        const before = parent.parentNumericalSource, after = commit.childNumericalSource, parentDescriptor = descriptor(before), childDescriptor = descriptor(after), original = parent.originalBinding, activation = before.inputSource.imported?.['activation'];
        if (!activation?.writeDigests || after.staticRows.length !== before.staticRows.length
            || !same(before.openingContext.context, after.openingContext.context))
            fail('FROZEN_SOURCE_COPY_MISMATCH');
        const writes = new Map(activation.writeDigests.map(row => [`${row.tableName}:${row.key}`, row.sha256]));
        const materialRows = before.staticRows.map((row, index) => {
            const copied = after.staticRows[index], suffix = row.key.slice(parent.parentSessionId.length + 2), activationKey = `${original.sourceRecordSessionId}__${suffix}`, originalActivationSha256 = writes.get(`${row.table}:${activationKey}`) ?? null;
            if (copied.table !== row.table || copied.key !== `${childId}__${suffix}` || copied.exists !== row.exists
                || copied.sha256 !== row.sha256)
                fail('FROZEN_SOURCE_COPY_MISMATCH');
            return { table: row.table, parentKey: row.key, childKey: copied.key, exists: row.exists,
                parentValueSha256: row.sha256, childValueSha256: copied.sha256,
                originalActivationKey: originalActivationSha256 === null ? null : activationKey, originalActivationSha256,
                mappingKind: 'identity-copy' };
        });
        const originalImport = { ownerSessionId: original.sourceRecordSessionId, importId: original.importId,
            rawSha256: original.rawSha256, normalizedSha256: original.normalizedSha256, transactionId: original.transactionId,
            coverageSha256: original.coverageSha256, recordSha256: original.importRecordRef.sha256, activationSha256: original.activationSha256 }, body = { schemaVersion: 2, encoding: 'native-mvu-derived-source-proof-v2',
            operationId: parent.operationId, anchorSha256: parent.anchorSha256, parentSessionId: parent.parentSessionId,
            childSessionId: childId, expectedSeedLength: parent.nativeCut.seedLength,
            parentInheritedEventCount: parent.nativeCut.parentInheritedEventCount,
            parentSourceSha256: recordSha256(parentDescriptor), childSourceSha256: recordSha256(childDescriptor),
            parentPointerSha256: recordSha256(before.pointer), childPointerSha256: recordSha256(after.pointer),
            sourceInheritance: inheritance, numericalProjection: { policy: 'roleplay-input-source-observation-v1',
                parentCaptureSha256: before.captureSha256, childCaptureSha256: after.captureSha256,
                copyRelationPolicy: 'exact-static-copy-with-declared-owner-rebinding-v1' }, originalImport, materialRows,
            macroContext: { parentBindingSha256: before.openingContext.bindingSha256,
                childBindingSha256: after.openingContext.bindingSha256, valuesSha256: recordSha256(after.openingContext.context) } };
        return validateMvuFrozenDerivedSourceProofV2({ ...body, proofSha256: recordSha256(body) });
    }
    function historicalProof(raw) {
        const proof = validateMvuFrozenDerivedSourceProofV2(raw), current = owner().readCommittedStaticSourceInheritance(proof.childSessionId), expected = capture(proof.childSessionId, frozenInheritanceRefV1(current.prepared));
        if (!same(proof, expected))
            fail('FROZEN_SOURCE_COMMIT_CHANGED');
        return { proof, current };
    }
    function current(raw) {
        try {
            const { proof } = historicalProof(raw);
            return recordSha256(deps.readSourceDescriptor(proof.childSessionId)) === proof.childSourceSha256
                && deps.readSourceSha256(proof.childSessionId) === proof.childSourceSha256;
        }
        catch {
            return false;
        }
    }
    function historical(priorRaw, successorRaw) {
        try {
            const successor = historicalProof(successorRaw), prior = validateMvuDerivedSourceProofUnion(priorRaw);
            if (successor.proof.parentSessionId !== prior.childSessionId
                || successor.proof.parentSourceSha256 !== prior.childSourceSha256
                || successor.proof.parentPointerSha256 !== prior.childPointerSha256
                || !same(successor.proof.originalImport, prior.originalImport)
                || !same(successor.proof.macroContext.valuesSha256, prior.macroContext.valuesSha256)
                || successor.proof.macroContext.parentBindingSha256 !== prior.macroContext.childBindingSha256)
                return false;
            if (prior.schemaVersion === 1 && !old.verifyDenialBindingFacts(prior))
                return false;
            if (prior.schemaVersion === 2)
                historicalProof(prior);
            const rows = new Map(successor.proof.materialRows.map(row => [`${row.table}:${row.parentKey}`, row]));
            return prior.materialRows.length === rows.size && prior.materialRows.every(row => {
                const next = rows.get(`${row.table}:${row.childKey}`);
                return !!next && next.exists === row.exists && next.parentValueSha256 === (prior.schemaVersion === 1
                    ? row.sha256
                    : row.childValueSha256);
            });
        }
        catch {
            return false;
        }
    }
    function historicalPrepared(priorRaw, successorRef) {
        try {
            const successor = prepared(successorRef.childSessionId), prior = validateMvuDerivedSourceProofUnion(priorRaw), parent = successor.frozen.parentNumericalSource, original = successor.frozen.originalBinding;
            if (!same(successor.ref, successorRef) || successor.frozen.parentSessionId !== prior.childSessionId
                || successor.parentSourceSha256 !== prior.childSourceSha256
                || recordSha256(parent.pointer) !== prior.childPointerSha256
                || parent.openingContext.bindingSha256 !== prior.macroContext.childBindingSha256
                || recordSha256(parent.openingContext.context) !== prior.macroContext.valuesSha256
                || original.sourceRecordSessionId !== prior.originalImport.ownerSessionId || original.importId !== prior.originalImport.importId
                || original.rawSha256 !== prior.originalImport.rawSha256 || original.normalizedSha256 !== prior.originalImport.normalizedSha256
                || original.coverageSha256 !== prior.originalImport.coverageSha256 || original.transactionId !== prior.originalImport.transactionId
                || original.importRecordRef.sha256 !== prior.originalImport.recordSha256
                || original.activationSha256 !== prior.originalImport.activationSha256)
                return false;
            if (prior.schemaVersion === 1 && !old.verifyDenialBindingFacts(prior))
                return false;
            if (prior.schemaVersion === 2)
                historicalProof(prior);
            const rows = new Map(parent.staticRows.map(row => [`${row.table}:${row.key}`, row]));
            return prior.materialRows.length === rows.size && prior.materialRows.every(row => {
                const next = rows.get(`${row.table}:${row.childKey}`);
                return !!next && next.exists === row.exists && next.sha256 === (prior.schemaVersion === 1
                    ? row.sha256
                    : row.childValueSha256);
            });
        }
        catch {
            return false;
        }
    }
    const denial = (raw) => { try {
        historicalProof(raw);
        return true;
    }
    catch {
        return false;
    } };
    return { prepared, capture, current, historical, historicalPrepared, verifyDenialBindingFacts: denial,
        validate: validateMvuFrozenDerivedSourceProofV2 };
}
