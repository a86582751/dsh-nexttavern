// Generated from runtime/alpha3/src/operations/native-fork-host-profile.mts; edit the TypeScript source.
/** Host payload membership belongs to the assembly recipes; activation remains manual. */
export const HOST_VERSION = '0.1.7-rc.2';
/** Historical unprofiled inventories and schema 1 receipts retain their original members. */
export const NATIVE_FORKS = [
    '@deepseek-ai/dsh-llm',
    '@deepseek-ai/dsh-session',
    '@deepseek-ai/dsh-agent-loop',
];
function descriptor(value) {
    const row = value;
    if (!row || row.schemaVersion !== 1 || row.encoding !== 'owned-native-host-fork-profile-v1' ||
        row.id !== 'nexttavern-owned-author-dialog-v1' || row.hostVersion !== HOST_VERSION ||
        row.activation !== 'manual-only')
        throw Error('Unsupported host fork profile');
    return { schemaVersion: 1, encoding: row.encoding, id: row.id, hostVersion: row.hostVersion,
        activation: row.activation };
}
/** Called once while writing an inventory. No second package-name list is maintained. */
export function makeHostForkProfile(value, recipes) {
    return readHostForkProfile({ ...value, members: recipes.map(recipe => recipe.name) });
}
/** Parse the durable inventory boundary; undefined identifies the historical payload. */
export function readHostForkProfile(value) {
    if (value === undefined)
        return undefined;
    const profile = descriptor(value);
    const members = value.members;
    if (!Array.isArray(members) || members.length === 0 ||
        members.some(name => typeof name !== 'string' || !/^@deepseek-ai\/dsh-[a-z0-9-]+$/.test(name)) ||
        new Set(members).size !== members.length)
        throw Error('Invalid host fork profile members');
    return { ...profile, members: [...members] };
}
/** Consumers use the parsed member set; old receipts remain a three-member contract. */
export const hostForkNames = (profile) => profile?.members ?? NATIVE_FORKS;
