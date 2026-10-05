// Generated from runtime/alpha3/src/core/tavern-author-browser-artifact.mts; edit the TypeScript source.
/** Fixed-generation artifact loader. Protected admission belongs to Core's
 * package owner; this module binds actual module/TS bytes once per process.
 * No caller DTO, hash, directory, worker URL or permission can mint a brand. */
import { readFileSync } from 'node:fs';
import { AUTHOR_BROWSER_MODULES, AUTHOR_BROWSER_RUNTIME_PINS, authorBrowserAssetSha, authorBrowserImplementationV1 } from './tavern-author-browser-descriptor.mjs';
import { BROWSER_PROFILE_V1, BROWSER_CAPABILITY_CONTRACT_V1 } from './tavern-author-browser-profile.mjs';
const ownRoot = new URL('../', import.meta.url);
const ownedArtifacts = new WeakMap();
let loaded;
export function loadOwnedAuthorBrowserArtifactV1() {
    if (loaded)
        return loaded;
    const moduleBytes = Object.entries(AUTHOR_BROWSER_MODULES).map(([role, relative]) => ({
        role, path: relative, bytes: readFileSync(new URL(relative, ownRoot))
    }));
    const identities = moduleBytes.map(({ path, bytes }) => ({ path, sha256: authorBrowserAssetSha(bytes) }));
    // This absolute package-relative entry has no Node search or build-tools
    // fallback. The independent component owns the complete published TS lib.
    const typescriptArtifactSha256 = authorBrowserAssetSha(readFileSync(new URL('node_modules/typescript/lib/typescript.js', ownRoot)));
    const runtime = Object.freeze({ id: 'native-author-browser-runtime', version: 1,
        implementationSha256: authorBrowserImplementationV1('runtime', identities, typescriptArtifactSha256, BROWSER_PROFILE_V1.sha256),
        capabilityContractSha256: BROWSER_CAPABILITY_CONTRACT_V1.contractSha256 });
    const compiler = Object.freeze({ id: 'native-author-browser-profile-compiler', version: 1,
        typescriptVersion: AUTHOR_BROWSER_RUNTIME_PINS.typescript,
        implementationSha256: authorBrowserImplementationV1('compiler', identities, typescriptArtifactSha256, BROWSER_PROFILE_V1.sha256) });
    const child = moduleBytes.find(row => row.role === 'child'), guard = moduleBytes.find(row => row.role === 'guard');
    const artifact = Object.freeze({ schemaVersion: 1, childJavascript: child.bytes.toString('utf8'),
        childSha256: authorBrowserAssetSha(child.bytes), guardJavascript: guard.bytes.toString('utf8'),
        guardSha256: authorBrowserAssetSha(guard.bytes), identity: runtime });
    ownedArtifacts.set(artifact, { runtime, compiler, worker: new URL(AUTHOR_BROWSER_MODULES['ast-worker'], ownRoot) });
    return loaded = artifact;
}
function owned(artifact) {
    const state = ownedArtifacts.get(artifact);
    if (!state)
        throw Error('BROWSER_RUNTIME_PRODUCER_NOT_OWNED');
    return state;
}
export const ownedBrowserRuntimeIdentityV1 = (artifact) => owned(artifact).runtime;
export const ownedBrowserCompilerIdentityV1 = (artifact) => owned(artifact).compiler;
export const ownedBrowserAstWorkerURLV1 = (artifact) => new URL(owned(artifact).worker);
