// Generated from runtime/alpha3/src/core/roleplay-author-profile.ts; edit the TypeScript source.
/** The actual roleplay Domain owns one identity for its shared author data. */
import { randomUUID } from 'node:crypto';
import { withTavernLock } from './tavern-task-support.js';
export const AUTHOR_PROFILE_IDENTITY_KEY = 'author-profile-identity-v1';
export function readAuthorProfileIdentityV1(table) {
    const value = table.get(AUTHOR_PROFILE_IDENTITY_KEY);
    if (value === undefined)
        return;
    if (value.schemaVersion !== 1 || value.encoding !== 'author-profile-identity-v1'
        || typeof value.profileId !== 'string' || !value.profileId)
        throw Error('AUTHOR_PROFILE_IDENTITY_INVALID');
    return value;
}
export async function ensureAuthorProfileIdentityV1(table) {
    return withTavernLock(table, AUTHOR_PROFILE_IDENTITY_KEY, async () => {
        const previous = readAuthorProfileIdentityV1(table);
        if (previous)
            return previous;
        const value = Object.freeze({ schemaVersion: 1,
            encoding: 'author-profile-identity-v1', profileId: randomUUID() });
        try {
            await table.put(AUTHOR_PROFILE_IDENTITY_KEY, value);
        }
        catch (error) {
            if (readAuthorProfileIdentityV1(table)?.profileId !== value.profileId)
                throw error;
        }
        const written = readAuthorProfileIdentityV1(table);
        if (written?.profileId !== value.profileId)
            throw Error('AUTHOR_PROFILE_IDENTITY_WRITE_UNKNOWN');
        return written;
    });
}
