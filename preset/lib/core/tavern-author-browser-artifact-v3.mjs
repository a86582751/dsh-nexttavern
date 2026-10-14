// Generated from runtime/alpha3/src/core/tavern-author-browser-artifact-v3.mts; edit the TypeScript source.
/** Physical owned Worker/compiler bytes. These brands grant producer identity;
 * Core still owns protected execution admission and the live Source lifetime. */
import { readFileSync } from 'node:fs';
import { AUTHOR_BROWSER_MODULES_V3, AUTHOR_BROWSER_RUNTIME_PINS_V3, AUTHOR_BROWSER_WASM_V3, AUTHOR_BROWSER_WASM_SHA256_V3, authorBrowserAssetShaV3, authorBrowserImplementationV3 } from './tavern-author-browser-descriptor-v3.mjs';
import { BROWSER_PROFILE_V3, BROWSER_CAPABILITY_CONTRACT_V3 } from './tavern-author-browser-profile-v3.mjs';
const root = new URL('../', import.meta.url);
const ownedArtifacts = new WeakMap();
let loaded;
export function loadOwnedAuthorBrowserArtifactV3() {
    if (loaded)
        return loaded;
    const modules = Object.entries(AUTHOR_BROWSER_MODULES_V3).map(([role, path]) => ({ role, path,
        bytes: readFileSync(new URL(path, root)) }));
    const wasm = readFileSync(new URL(AUTHOR_BROWSER_WASM_V3, root));
    if (authorBrowserAssetShaV3(wasm) !== AUTHOR_BROWSER_WASM_SHA256_V3)
        throw Error('BROWSER_WASM_IDENTITY');
    const moduleIdentity = (roles) => modules.filter(row => roles.includes(row.role))
        .map(({ path, bytes }) => ({ path, sha256: authorBrowserAssetShaV3(bytes) }));
    const dependencyIdentity = (paths) => paths.map(path => ({ path,
        sha256: authorBrowserAssetShaV3(readFileSync(new URL(path, root))) }));
    // parse5/css-tree are bundled into the Node provider/AST worker. Their
    // physical parser bytes therefore belong to this compiler module closure.
    const compilerDependencies = dependencyIdentity(['node_modules/typescript/lib/typescript.js']);
    const runtimeDependencies = dependencyIdentity(['node_modules/quickjs-emscripten-core/dist/index.mjs',
        'node_modules/@jitl/quickjs-ffi-types/dist/index.mjs',
        'node_modules/@jitl/quickjs-wasmfile-release-asyncify/dist/ffi.mjs',
        'node_modules/@jitl/quickjs-wasmfile-release-asyncify/dist/emscripten-module.browser.mjs', AUTHOR_BROWSER_WASM_V3]);
    const runtime = Object.freeze({ id: 'native-author-browser-runtime', version: 3,
        quickjsVersion: AUTHOR_BROWSER_RUNTIME_PINS_V3['quickjs-emscripten-core'],
        implementationSha256: authorBrowserImplementationV3('runtime', moduleIdentity(['execution-worker']), runtimeDependencies, BROWSER_PROFILE_V3.sha256, BROWSER_CAPABILITY_CONTRACT_V3.contractSha256),
        capabilityContractSha256: BROWSER_CAPABILITY_CONTRACT_V3.contractSha256 });
    const compiler = Object.freeze({ id: 'native-author-browser-profile-compiler', version: 3,
        typescriptVersion: AUTHOR_BROWSER_RUNTIME_PINS_V3.typescript,
        implementationSha256: authorBrowserImplementationV3('compiler', moduleIdentity(['provider', 'ast-worker']), compilerDependencies, BROWSER_PROFILE_V3.sha256, BROWSER_CAPABILITY_CONTRACT_V3.contractSha256) });
    const worker = modules.find(row => row.role === 'execution-worker');
    const artifact = Object.freeze({ schemaVersion: 3, compiler, identity: runtime,
        executionWorkerJavascript: worker.bytes.toString('utf8'), executionWorkerSha256: authorBrowserAssetShaV3(worker.bytes),
        wasm: Object.freeze({ encoding: 'base64', data: wasm.toString('base64'), sha256: AUTHOR_BROWSER_WASM_SHA256_V3 }) });
    ownedArtifacts.set(artifact, { runtime, compiler, astWorker: new URL(AUTHOR_BROWSER_MODULES_V3['ast-worker'], root) });
    return loaded = artifact;
}
function owned(artifact) {
    const result = ownedArtifacts.get(artifact);
    if (!result)
        throw Error('BROWSER_RUNTIME_PRODUCER_NOT_OWNED');
    return result;
}
export const ownedBrowserRuntimeIdentityV3 = (artifact) => owned(artifact).runtime;
export const ownedBrowserCompilerIdentityV3 = (artifact) => owned(artifact).compiler;
export const ownedBrowserAstWorkerURLV3 = (artifact) => new URL(owned(artifact).astWorker);
