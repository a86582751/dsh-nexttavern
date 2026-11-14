// Generated from runtime/alpha3/src/core/tavern-mvu-schema-import-policy.ts; edit the TypeScript source.
/** Fixed P0 C-source aliases to the owned native schema bridge.
 * Upstream hashes identify the researched snapshot, without fetching or
 * executing that module. This policy grants no Source/publication authority. */
export const PINNED_C_SCHEMA_IMPORT_POLICY_V1 = Object.freeze({
    schemaVersion: 1, id: 'p0-c-schema-native-adapter', version: 1,
    upstreamRootSha256: '78c40f52d81022d9d769a923a49e673b8babb562656051a7d0410b6b19f45184',
    upstreamRootBytes: 4705,
    exports: Object.freeze(['registerMvuSchema']),
    entries: Object.freeze([
        Object.freeze({
            specifier: 'https://cdn.jsdelivr.net/gh/StageDog/tavern_resource@523b1f0d82d3debbc2435ec35530f02e8d388219/dist/util/mvu_zod.js',
            specifierSha256: 'f11d15a0f5aad906cb7a5732d2763ef5dc67a52e6129e06c85bd868cb124d2c5',
        }),
        Object.freeze({
            specifier: 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource@523b1f0d82d3debbc2435ec35530f02e8d388219/dist/util/mvu_zod.js',
            specifierSha256: '9034368ae6e63d01c3d2e1bf0ecac1fae202f287007e1042aa89e9633929660c',
        }),
    ]),
});
/** Fresh generic admission owns this independent alias policy. Historical
 * policy versions (including program-v4's retained policy) remain unchanged;
 * importing these DATA aliases does not initialize a historical program. */
export const GENERIC_C_SCHEMA_IMPORT_POLICY_V1 = Object.freeze({
    id: 'generic-c-schema-owned-adapter', version: 1,
    entries: Object.freeze([...PINNED_C_SCHEMA_IMPORT_POLICY_V1.entries.map(entry => entry.specifier),
        'https://fastly.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js',
        'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js',
        'https://cdn.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js']),
});
