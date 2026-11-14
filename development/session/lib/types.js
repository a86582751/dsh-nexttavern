// Generated from runtime/alpha3/compat/session/src/types.ts; edit the TypeScript source.
import { brandNumber, brandString } from '@deepseek-ai/dsh-brand';
/**
 * Brand a string as a {@link SessionId}.
 * @param id - the raw session id string.
 * @returns the same string with the session-id brand.
 */
export function SessionId(id) {
    return brandString(id);
}
/**
 * Admit a numeric value as an existing Session event position.
 * @param value - non-negative safe integer admitted by the owning log operation.
 * @returns the same number with the Session-sequence brand.
 */
export function SessionSeq(value) {
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
        throw new TypeError(`SessionSeq must be a non-negative safe integer, got ${String(value)}`);
    }
    return brandNumber(value);
}
/**
 * Admit a numeric value as a Session log offset.
 * @param value - non-negative safe integer used as a gap or prefix length.
 * @returns the same number with the Session-log-offset brand.
 */
export function SessionLogOffset(value) {
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
        throw new TypeError(`SessionLogOffset must be a non-negative safe integer, got ${String(value)}`);
    }
    return brandNumber(value);
}
/**
 * Current logical Session format version, stamped into every newly written
 * {@link SessionHeader}. Current Session and persistence code accept only this
 * value; header-only readers classify supported historical formats, while an
 * event-body read composes the build-static adjacent chain and publishes only
 * this final generation before constructing a Session.
 *
 * The version is a single monotonic integer with no major/minor split. Whether
 * a bump is needed is decided by what the WRITER emits, never by what a newer
 * reader can accept: bump exactly when an older runtime could no longer handle
 * a new log with full semantic correctness ("parses without error" is not
 * correctness — silently skipping content that shapes reconstruction is a
 * wrong read). Only structural changes reach that bar: the header shape, the
 * {@link SessionEvent} envelope, core event semantics, or the surface
 * mechanism (the {@link SurfaceEventType} set and {@link SurfaceOp} variants).
 * Adding an ordinary event type does not bump — the per-event
 * {@link SessionEvent.ignorable} guard covers vocabulary growth instead. When
 * in doubt, bump: a near-identity upgrade step is almost free, a missed bump
 * makes older runtimes read new logs wrong silently. The released migration,
 * immutable prior-generation, and current fast-path rules are recorded in
 * `.agents/notes/implemented/architecture/2026-08-31-released-session-format-migrations.md`.
 */
export const SESSION_FORMAT_VERSION = 4;
const publicationRecord = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw Error('PUBLISHED_INPUT_METADATA_INVALID');
    return value;
};
const publicationText = (value) => typeof value === 'string' && value.length > 0;
const publicationCount = (value) => Number.isSafeInteger(value) && Number(value) >= 0;
const publicationSha = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
/** Read one persisted source marker. Consumers reuse this decoder. */
export function readNativeAuthorPublicationV1(source) {
    const value = publicationRecord(source).authorPublication;
    if (value === undefined)
        return;
    const row = publicationRecord(value);
    if (row.schemaVersion !== 1 || row.encoding !== 'native-author-publication-v1'
        || !publicationText(row.operationId) || !publicationText(row.producer) || !publicationText(row.origin)
        || !publicationCount(row.index) || !publicationCount(row.count) || row.count === 0 || row.index >= row.count
        || !publicationSha(row.batchSha256))
        throw Error('PUBLISHED_INPUT_METADATA_INVALID');
    const owner = publicationRecord(source);
    if (owner.kind !== 'user' || Object.hasOwn(owner, 'rpcId'))
        throw Error('PUBLISHED_INPUT_SOURCE_INVALID');
    return value;
}
export function readNativePublishedTriggerV1(data) {
    const value = publicationRecord(data).publishedInput;
    if (value === undefined)
        return;
    const row = publicationRecord(value);
    if (row.schemaVersion !== 1 || row.encoding !== 'native-published-trigger-v1'
        || !publicationText(row.operationId) || !Array.isArray(row.users) || !row.users.length)
        throw Error('PUBLISHED_TRIGGER_METADATA_INVALID');
    for (const user of row.users) {
        const ref = publicationRecord(user);
        if (!publicationCount(ref.userSeq) || !publicationText(ref.messageId) || !publicationSha(ref.messageSha256))
            throw Error('PUBLISHED_TRIGGER_METADATA_INVALID');
    }
    return value;
}
