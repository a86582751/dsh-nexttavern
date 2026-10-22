/** Protected admission is Core-owned; this fixed loader brands physical bytes. */
import {readFileSync} from 'node:fs'
import {AUTHOR_BROWSER_MODULES_V2,AUTHOR_BROWSER_RUNTIME_PINS_V2,AUTHOR_BROWSER_WASM_V2,
  AUTHOR_BROWSER_WASM_SHA256_V2,authorBrowserAssetShaV2,authorBrowserImplementationV2}
  from './tavern-author-browser-descriptor-v2.mjs'
import {BROWSER_PROFILE_V2,BROWSER_CAPABILITY_CONTRACT_V2} from './tavern-author-browser-profile-v2.mjs'
import type {BrowserRuntimeArtifactV2,BrowserRuntimeIdentityV2,BrowserCompilerIdentityV2}
  from './tavern-author-browser-types-v2.mjs'

const root=new URL('../',import.meta.url)
const ownedArtifacts=new WeakMap<BrowserRuntimeArtifactV2,{
  runtime:BrowserRuntimeIdentityV2;compiler:BrowserCompilerIdentityV2;astWorker:URL}>()
let loaded:BrowserRuntimeArtifactV2|undefined
export function loadOwnedAuthorBrowserArtifactV2():BrowserRuntimeArtifactV2 {
  if(loaded)return loaded
  const modules=Object.entries(AUTHOR_BROWSER_MODULES_V2).map(([role,path])=>({role,path,
    bytes:readFileSync(new URL(path,root))}))
  const wasm=readFileSync(new URL(AUTHOR_BROWSER_WASM_V2,root))
  if(authorBrowserAssetShaV2(wasm)!==AUTHOR_BROWSER_WASM_SHA256_V2)throw Error('BROWSER_WASM_IDENTITY')
  const identities=modules.map(({path,bytes})=>({path,sha256:authorBrowserAssetShaV2(bytes)}))
  const dependencyPaths=['node_modules/typescript/lib/typescript.js',
    'node_modules/quickjs-emscripten-core/dist/index.mjs','node_modules/@jitl/quickjs-ffi-types/dist/index.mjs',
    'node_modules/@jitl/quickjs-wasmfile-release-asyncify/dist/ffi.mjs',
    'node_modules/@jitl/quickjs-wasmfile-release-asyncify/dist/emscripten-module.browser.mjs',AUTHOR_BROWSER_WASM_V2]
  const dependencies=dependencyPaths.map(path=>({path,sha256:authorBrowserAssetShaV2(readFileSync(new URL(path,root)))}))
  const runtime:BrowserRuntimeIdentityV2=Object.freeze({id:'native-author-browser-runtime',version:2,
    quickjsVersion:AUTHOR_BROWSER_RUNTIME_PINS_V2['quickjs-emscripten-core'],
    implementationSha256:authorBrowserImplementationV2('runtime',identities,dependencies,BROWSER_PROFILE_V2.sha256),
    capabilityContractSha256:BROWSER_CAPABILITY_CONTRACT_V2.contractSha256})
  const compiler:BrowserCompilerIdentityV2=Object.freeze({id:'native-author-browser-profile-compiler',version:2,
    typescriptVersion:AUTHOR_BROWSER_RUNTIME_PINS_V2.typescript,
    implementationSha256:authorBrowserImplementationV2('compiler',identities,dependencies,BROWSER_PROFILE_V2.sha256)})
  const role=(name:string)=>modules.find(row=>row.role===name)!
  const child=role('child'),guard=role('guard'),worker=role('execution-worker')
  const artifact:BrowserRuntimeArtifactV2=Object.freeze({schemaVersion:2,
    childJavascript:child.bytes.toString('utf8'),childSha256:authorBrowserAssetShaV2(child.bytes),
    guardJavascript:guard.bytes.toString('utf8'),guardSha256:authorBrowserAssetShaV2(guard.bytes),
    executionWorkerJavascript:worker.bytes.toString('utf8'),executionWorkerSha256:authorBrowserAssetShaV2(worker.bytes),
    wasm:Object.freeze({encoding:'base64' as const,data:wasm.toString('base64'),sha256:AUTHOR_BROWSER_WASM_SHA256_V2}),
    identity:runtime})
  ownedArtifacts.set(artifact,{runtime,compiler,astWorker:new URL(AUTHOR_BROWSER_MODULES_V2['ast-worker'],root)})
  return loaded=artifact
}
function owned(artifact:BrowserRuntimeArtifactV2) {
  const result=ownedArtifacts.get(artifact)
  if(!result)throw Error('BROWSER_RUNTIME_PRODUCER_NOT_OWNED')
  return result
}
export const ownedBrowserRuntimeIdentityV2=(artifact:BrowserRuntimeArtifactV2)=>owned(artifact).runtime
export const ownedBrowserCompilerIdentityV2=(artifact:BrowserRuntimeArtifactV2)=>owned(artifact).compiler
export const ownedBrowserAstWorkerURLV2=(artifact:BrowserRuntimeArtifactV2)=>new URL(owned(artifact).astWorker)
