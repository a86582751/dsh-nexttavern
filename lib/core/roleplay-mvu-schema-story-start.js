// Generated from runtime/alpha3/src/core/roleplay-mvu-schema-story-start.ts; edit the TypeScript source.
/** A Native maintenance update starts under its real running Work. This DATA
 * identifies that one computation without manufacturing a completed receipt. */
import { recordSha256, sha256 } from './roleplay-data.js';
import { freezeMvuSchemaStoryData, validateMvuSchemaNumericalSnapshot } from './roleplay-mvu-schema-story-types.js';
import { validateSchemaStorySourceFrame } from './roleplay-mvu-schema-source.js';
import { validateSchemaSourceCut } from './roleplay-mvu-schema-journal.js';
import { validateMvuScopeReadRefV2 } from './tavern-mvu-scope-view-v2.js';
import { createImmutableDescriptorValidator } from './roleplay-mvu-schema-descriptor-data.js';
export const mvuSchemaStoryStartKey = (sessionId, preparationId, canonicalSeq) => `${sessionId}__mvu-schema-maintenance-start-${preparationId}-${canonicalSeq}`;
const same = (left, right) => recordSha256(left) === recordSha256(right);
function fail() { throw Error('SCHEMA_STORY_START_INVALID'); }
export function makeMvuSchemaStoryStart(input) {
    const identity = recordSha256({ work: input.work, canonical: input.canonical, realmEpoch: input.realmEpoch }), body = { ...input, schemaVersion: 1, encoding: 'native-mvu-196-story-start-v1',
        randomSeed: identity,
        selectors: [{ sessionId: input.work.sessionId, batchId: `story-${identity}-1`, anchor: input.initialCut.anchor }] };
    return validateMvuSchemaStoryStart({ ...body, startSha256: recordSha256(body) });
}
/** Only the descriptor boundary checks these bytes. Actual Work, Native history
 * and current Source remain the running/closing owner's responsibilities. */
const validateStartDescriptor = createImmutableDescriptorValidator(validateStartUncached);
export function validateMvuSchemaStoryStart(input) {
    return validateStartDescriptor(input);
}
function validateStartUncached(input) {
    const value = freezeMvuSchemaStoryData(input), { startSha256, ...body } = value;
    const fields = ['schemaVersion', 'encoding', 'executorVersion', 'work', 'canonical', 'base', 'currentFrame',
        'realmEpoch', 'programSha256', 'initialCut', 'clockEpochMs', 'randomSeed', 'selectors', 'epoch', 'serverProgramSha256',
        'scopeReadRef', 'startSha256', ...Object.hasOwn(value, 'errorPolicy') ? ['errorPolicy'] : []];
    if (Object.keys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field))
        || value.schemaVersion !== 1 || value.encoding !== 'native-mvu-196-story-start-v1' || value.executorVersion !== 4
        || startSha256 !== recordSha256(body))
        fail();
    const { work, canonical, base, currentFrame, initialCut } = value, checkpoint = work.checkpoint, currency = work.currency;
    validateMvuSchemaNumericalSnapshot(base);
    validateSchemaStorySourceFrame(currentFrame);
    validateSchemaSourceCut(initialCut);
    validateMvuScopeReadRefV2(value.scopeReadRef);
    const anchor = { kind: 'story', preparationId: currency.preparationId, attemptGeneration: currency.attemptGeneration,
        receiptGeneration: currency.receiptGeneration, turn: checkpoint.actualTurn, canonicalSeq: canonical.seq,
        messageId: canonical.messageId, messageVersionSha256: canonical.versionSha256 }, identity = recordSha256({ work, canonical, realmEpoch: value.realmEpoch });
    if (work.sessionId !== base.sessionId || checkpoint.sessionId !== work.sessionId || currentFrame.sessionId !== work.sessionId
        || work.workKey !== `${work.sessionId}__native-input-v2-work-${recordSha256(checkpoint.refs)}`
        || !same(work.refs, checkpoint.refs) || checkpoint.preparation.credentialSha256 !== currency.credentialSha256
        || currency.source.kind !== 'story' || currency.source.headRef?.kind !== 'schema-head'
        || currency.source.sourceSha256 !== base.sourceSha256 || canonical.narrativeSha256 !== sha256(canonical.narrative)
        || initialCut.sessionId !== work.sessionId || initialCut.ownerSessionId !== work.sessionId
        || initialCut.sourceSnapshotSha256 !== currentFrame.snapshotSha256 || initialCut.materialSha256 !== currentFrame.materialSha256
        || initialCut.nativeCut <= canonical.seq || !same(initialCut.anchor, anchor)
        || value.scopeReadRef.sourceNativeCutSha256 !== recordSha256(initialCut)
        || value.randomSeed !== identity || !same(value.selectors, [{ sessionId: work.sessionId,
            batchId: `story-${identity}-1`, anchor }]))
        fail();
    return value;
}
