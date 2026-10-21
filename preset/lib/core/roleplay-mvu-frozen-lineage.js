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
    return validateFrozenSourceProof(raw, 2);
}
export function validateMvuFrozenDerivedSourceProofV3(raw) {
    return validateFrozenSourceProof(raw, 3);
}
function validateFrozenSourceProof(raw, version) {
    const value = inheritanceDataV1(raw);
    inheritanceExactV1(value, fields);
    if (value.schemaVersion !== version || value.encoding !== `native-mvu-derived-source-proof-v${version}`
        || !['operationId', 'parentSessionId', 'childSessionId'].every(key => inheritanceIdV1(value[key]))
        || value.parentSessionId === value.childSessionId
        || !Number.isSafeInteger(value.expectedSeedLength) || Number(value.expectedSeedLength) < 1
        || !Number.isSafeInteger(value.parentInheritedEventCount) || Number(value.parentInheritedEventCount) < 0
        || (version === 2 ? Number(value.parentInheritedEventCount) >= Number(value.expectedSeedLength)
            : Number(value.parentInheritedEventCount) < Number(value.expectedSeedLength))
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
    return value.schemaVersion === 2 ? validateMvuFrozenDerivedSourceProofV2(value)
        : value.schemaVersion === 3 ? validateMvuFrozenDerivedSourceProofV3(value) : validateMvuDerivedSourceProof(value);
}
const descriptor = (raw) => describeRoleplayInputSourceV1(validateNumericalCaptureV1(raw).inputSource);
export function createRoleplayMvuFrozenLineage(deps) {
    const old = createRoleplayMvuLineage(deps);
    const owner = () => { const current = deps.sourceInheritance(); if (!current)
        fail('FROZEN_SOURCE_OWNER_UNAVAILABLE'); return current; };
    function preparedData(frozen) {
        const ref = frozenInheritanceRefV1(frozen), parentDescriptor = descriptor(frozen.parentNumericalSource);
        if (frozen.nativeCut.kind !== 'native-fork')
            fail('FROZEN_SOURCE_NATIVE_FORK_REQUIRED');
        return { frozen, ref, parentDescriptor, parentSourceSha256: recordSha256(parentDescriptor) };
    }
    function prepared(childId) { return preparedData(owner().readPreparedSourceInheritance(childId)); }
    function captureFromTransaction(childId, sourcePreparedRef, current, version) {
        const { prepared: parent, commit, inheritance } = current, ref = frozenInheritanceRefV1(parent);
        if (parent.nativeCut.kind !== 'native-fork')
            fail('FROZEN_SOURCE_NATIVE_FORK_REQUIRED');
        if (!same(ref, sourcePreparedRef) || !same(inheritance.preparedRef, sourcePreparedRef.preparedRef))
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
            coverageSha256: original.coverageSha256, recordSha256: original.importRecordRef.sha256, activationSha256: original.activationSha256 }, body = { schemaVersion: version, encoding: `native-mvu-derived-source-proof-v${version}`,
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
        return validateFrozenSourceProof({ ...body, proofSha256: recordSha256(body) }, version);
    }
    function capture(childId, sourcePreparedRef, version = 2) {
        return captureFromTransaction(childId, sourcePreparedRef, owner().readCommittedStaticSourceInheritance(childId), version);
    }
    function historicalProof(raw, subjectSessionId) {
        const proof = validateMvuDerivedSourceProofUnion(raw), subject = subjectSessionId ?? proof.childSessionId, source = owner();
        if (proof.schemaVersion === 1)
            fail();
        // An ancestor is already part of this live consumer's verified Source
        // lineage. Reading it as a new live subject would require an inactive Agent.
        const current = proof.childSessionId === subject ? source.readCommittedStaticSourceInheritance(subject)
            : source.readCommittedSourceLineage(subject).ancestors.find(row => row.prepared.childSessionId === proof.childSessionId);
        if (!current)
            fail('FROZEN_SOURCE_COMMIT_CHANGED');
        const expected = captureFromTransaction(proof.childSessionId, frozenInheritanceRefV1(current.prepared), current, proof.schemaVersion);
        if (!same(proof, expected))
            fail('FROZEN_SOURCE_COMMIT_CHANGED');
        return { proof, current };
    }
    function readHistorical(raw, subjectSessionId) {
        const { proof, current } = historicalProof(raw, subjectSessionId);
        return { proof, prepared: preparedData(current.prepared) };
    }
    /** The frozen transaction was established by historicalProof. Current
     * callers consume only today's numerical Source dependencies here. */
    function currentProof(proof) {
        try {
            return recordSha256(deps.readSourceDescriptor(proof.childSessionId)) === proof.childSourceSha256
                && deps.readSourceSha256(proof.childSessionId) === proof.childSourceSha256;
        }
        catch {
            return false;
        }
    }
    function current(raw) {
        try {
            return currentProof(historicalProof(raw).proof);
        }
        catch {
            return false;
        }
    }
    /** Completed numerical roots keep their birth transaction while editable
     * settings and material evolve. A replacement active import is still a
     * different origin. New inheritance publication uses current() above. */
    function completedOrigin(raw) {
        try {
            const { proof, current } = historicalProof(raw), original = describeRoleplayInputSourceV1(current.commit.childNumericalSource.inputSource), actual = deps.readSourceDescriptor(proof.childSessionId);
            return same(actual.pointer, original.pointer) && same(actual.importIdentity, original.importIdentity);
        }
        catch {
            return false;
        }
    }
    /** Source already froze today's copy. Join its original pointer to the old
     * fork origin; account/material changes do not rewrite that numerical birth. */
    function legacyPredecessorOrigin(prior, frozen) {
        const legacy = frozen.parentSource.legacyInheritance, original = frozen.originalBinding, identity = prior.originalImport;
        return frozen.parentSessionId === prior.childSessionId
            && !!legacy && !legacy.freshFirstTurn && legacy.childSessionId === prior.childSessionId
            && legacy.parentSessionId === prior.parentSessionId && legacy.seedLength === prior.expectedSeedLength
            && original.originalPointerRef.sha256 === prior.childPointerSha256
            && original.sourceRecordSessionId === identity.ownerSessionId && original.importId === identity.importId
            && original.rawSha256 === identity.rawSha256 && original.normalizedSha256 === identity.normalizedSha256
            && original.coverageSha256 === identity.coverageSha256 && original.transactionId === identity.transactionId
            && original.importRecordRef.sha256 === identity.recordSha256 && original.activationSha256 === identity.activationSha256
            && old.verifyDenialBindingFacts(prior);
    }
    function historical(priorRaw, successorRaw, subjectSessionId) {
        try {
            const closed = historicalProof(successorRaw, subjectSessionId), successor = closed.proof, prior = validateMvuDerivedSourceProofUnion(priorRaw);
            if (prior.schemaVersion !== 1) {
                // Source owns the direct ancestor transaction. Settings and editable
                // material can change between forks without rewriting that genesis.
                if (successor.parentSessionId !== prior.childSessionId
                    || !same(closed.current.prepared.parentSource.inheritance, prior.sourceInheritance))
                    return false;
                historicalProof(prior, subjectSessionId ?? successor.childSessionId);
                return true;
            }
            return legacyPredecessorOrigin(prior, closed.current.prepared);
        }
        catch {
            return false;
        }
    }
    function historicalPrepared(priorRaw, successorRef, subjectSessionId) {
        try {
            const successor = prepared(successorRef.childSessionId), prior = validateMvuDerivedSourceProofUnion(priorRaw);
            if (!same(successor.ref, successorRef))
                return false;
            if (prior.schemaVersion !== 1) {
                // The frozen Source owner already closed this exact ancestor. Its
                // historical numerical proof is checked against that transaction,
                // rather than requiring today's parent rows to match its birth rows.
                if (successor.frozen.parentSessionId !== prior.childSessionId
                    || !same(successor.frozen.parentSource.inheritance, prior.sourceInheritance))
                    return false;
                historicalProof(prior, subjectSessionId);
                return true;
            }
            return legacyPredecessorOrigin(prior, successor.frozen);
        }
        catch {
            return false;
        }
    }
    const denial = (raw, subjectSessionId) => {
        try {
            historicalProof(raw, subjectSessionId);
            return true;
        }
        catch {
            return false;
        }
    };
    return { prepared, capture, current, currentProof, completedOrigin, historical, historicalPrepared, readHistorical, verifyDenialBindingFacts: denial,
        validate: validateMvuFrozenDerivedSourceProofV2 };
}
