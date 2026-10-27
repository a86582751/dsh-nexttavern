/** Physical owned Worker/compiler bytes. These brands grant producer identity;
 * Core still owns protected execution admission and the live Source lifetime. */
import {readFileSync} from 'node:fs'
import {TYPESCRIPT_VERSION} from './tavern-typescript-runtime-descriptor.mjs'
import type {SharedTypeScriptIdentity} from './tavern-typescript-runtime-descriptor.mjs'
import {AUTHOR_BROWSER_MODULES_V3,AUTHOR_BROWSER_RUNTIME_PINS_V3,AUTHOR_BROWSER_WASM_V3,
  AUTHOR_BROWSER_WASM_SHA256_V3,authorBrowserAssetShaV3,authorBrowserImplementationV3}
  from './tavern-author-browser-descriptor-v3.mjs'
import {BROWSER_PROFILE_V3,BROWSER_CAPABILITY_CONTRACT_V3,
  BROWSER_STATE_PROFILE_V3,BROWSER_STATE_CAPABILITY_CONTRACT_V3,
  BROWSER_ROOT_SOURCE_PROFILE_V3,BROWSER_ROOT_SOURCE_CAPABILITY_CONTRACT_V3} from './tavern-author-browser-profile-v3.mjs'
import type {BrowserRuntimeArtifactV3,BrowserRuntimeIdentityV3,BrowserCompilerIdentityV3}
  from './tavern-author-browser-types-v3.mjs'

const root=new URL('../',import.meta.url)
const ownedArtifacts=new WeakMap<BrowserRuntimeArtifactV3,{
  runtime:BrowserRuntimeIdentityV3;compiler:BrowserCompilerIdentityV3;astWorker:URL}>()
const loaded=new Map<string,BrowserRuntimeArtifactV3>()
export function loadOwnedAuthorBrowserArtifactV3(sharedCompiler:SharedTypeScriptIdentity,
  componentGeneration:string):BrowserRuntimeArtifactV3 {
  const key=JSON.stringify({sharedCompiler,componentGeneration}),cached=loaded.get(key)
  if(cached)return cached
  const modules=Object.entries(AUTHOR_BROWSER_MODULES_V3).map(([role,path])=>({role,path,
    bytes:readFileSync(new URL(path,root))}))
  const wasm=readFileSync(new URL(AUTHOR_BROWSER_WASM_V3,root))
  if(authorBrowserAssetShaV3(wasm)!==AUTHOR_BROWSER_WASM_SHA256_V3)throw Error('BROWSER_WASM_IDENTITY')
  const moduleIdentity=(roles:readonly string[])=>modules.filter(row=>roles.includes(row.role))
    .map(({path,bytes})=>({path,sha256:authorBrowserAssetShaV3(bytes)}))
  const dependencyIdentity=(paths:readonly string[])=>paths.map(path=>({path,
    sha256:authorBrowserAssetShaV3(readFileSync(new URL(path,root)))}))
  // parse5/css-tree are bundled into the Node provider/AST worker. Their
  // physical parser bytes therefore belong to this compiler module closure.
  const compilerDependencies:ReturnType<typeof dependencyIdentity>=[]
  const runtimeDependencies=dependencyIdentity(['node_modules/quickjs-emscripten-core/dist/index.mjs',
    'node_modules/@jitl/quickjs-ffi-types/dist/index.mjs',
    'node_modules/@jitl/quickjs-wasmfile-release-asyncify/dist/ffi.mjs',
    'node_modules/@jitl/quickjs-wasmfile-release-asyncify/dist/emscripten-module.browser.mjs',AUTHOR_BROWSER_WASM_V3])
  const runtime:BrowserRuntimeIdentityV3=Object.freeze({id:'native-author-browser-runtime',version:3,
    quickjsVersion:AUTHOR_BROWSER_RUNTIME_PINS_V3['quickjs-emscripten-core'],
    implementationSha256:authorBrowserImplementationV3('runtime',moduleIdentity(['execution-worker']),runtimeDependencies,
      BROWSER_PROFILE_V3.sha256,BROWSER_CAPABILITY_CONTRACT_V3.contractSha256,sharedCompiler,componentGeneration),
    capabilityContractSha256:BROWSER_CAPABILITY_CONTRACT_V3.contractSha256})
  const stateIdentity:BrowserRuntimeIdentityV3=Object.freeze({id:'native-author-browser-runtime',version:3,
    quickjsVersion:AUTHOR_BROWSER_RUNTIME_PINS_V3['quickjs-emscripten-core'],
    implementationSha256:authorBrowserImplementationV3('runtime',moduleIdentity(['execution-worker']),runtimeDependencies,
      BROWSER_STATE_PROFILE_V3.sha256,BROWSER_STATE_CAPABILITY_CONTRACT_V3.contractSha256,sharedCompiler,componentGeneration),
    capabilityContractSha256:BROWSER_STATE_CAPABILITY_CONTRACT_V3.contractSha256})
  const rootSourceIdentity:BrowserRuntimeIdentityV3=Object.freeze({id:'native-author-browser-runtime',version:3,
    quickjsVersion:AUTHOR_BROWSER_RUNTIME_PINS_V3['quickjs-emscripten-core'],
    implementationSha256:authorBrowserImplementationV3('runtime',moduleIdentity(['execution-worker']),runtimeDependencies,
      BROWSER_ROOT_SOURCE_PROFILE_V3.sha256,BROWSER_ROOT_SOURCE_CAPABILITY_CONTRACT_V3.contractSha256,sharedCompiler,componentGeneration),
    capabilityContractSha256:BROWSER_ROOT_SOURCE_CAPABILITY_CONTRACT_V3.contractSha256})
  const compiler:BrowserCompilerIdentityV3=Object.freeze({id:'native-author-browser-profile-compiler',version:3,
    typescriptVersion:TYPESCRIPT_VERSION,
    implementationSha256:authorBrowserImplementationV3('compiler',moduleIdentity(['provider','ast-worker']),compilerDependencies,
      BROWSER_PROFILE_V3.sha256,BROWSER_CAPABILITY_CONTRACT_V3.contractSha256,sharedCompiler,componentGeneration)})
  const worker=modules.find(row=>row.role==='execution-worker')!
  const artifact:BrowserRuntimeArtifactV3=Object.freeze({schemaVersion:3,compiler,identity:runtime,stateIdentity,rootSourceIdentity,
    executionWorkerJavascript:worker.bytes.toString('utf8'),executionWorkerSha256:authorBrowserAssetShaV3(worker.bytes),
    wasm:Object.freeze({encoding:'base64' as const,data:wasm.toString('base64'),sha256:AUTHOR_BROWSER_WASM_SHA256_V3})})
  ownedArtifacts.set(artifact,{runtime,compiler,astWorker:new URL(AUTHOR_BROWSER_MODULES_V3['ast-worker'],root)})
  loaded.set(key,artifact);return artifact
}
function owned(artifact:BrowserRuntimeArtifactV3) {
  const result=ownedArtifacts.get(artifact)
  if(!result)throw Error('BROWSER_RUNTIME_PRODUCER_NOT_OWNED')
  return result
}
export const ownedBrowserRuntimeIdentityV3=(artifact:BrowserRuntimeArtifactV3)=>owned(artifact).runtime
export const ownedBrowserCompilerIdentityV3=(artifact:BrowserRuntimeArtifactV3)=>owned(artifact).compiler
export const ownedBrowserAstWorkerURLV3=(artifact:BrowserRuntimeArtifactV3)=>new URL(owned(artifact).astWorker)
