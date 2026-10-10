/** Fixed-generation artifact loader. Protected admission belongs to Core's
 * package owner; this module binds actual module/TS bytes once per process.
 * No caller DTO, hash, directory, worker URL or permission can mint a brand. */
import {readFileSync} from 'node:fs'
import {AUTHOR_BROWSER_MODULES,AUTHOR_BROWSER_RUNTIME_PINS,authorBrowserAssetSha,
  authorBrowserImplementationV1} from './tavern-author-browser-descriptor.mjs'
import {BROWSER_PROFILE_V1,BROWSER_CAPABILITY_CONTRACT_V1} from './tavern-author-browser-profile.mjs'
import type {BrowserRuntimeArtifactV1,BrowserRuntimeIdentityV1,BrowserCompilerIdentityV1}
  from './tavern-author-browser-types.mjs'

const ownRoot=new URL('../',import.meta.url)
const ownedArtifacts=new WeakMap<BrowserRuntimeArtifactV1,{
  runtime:BrowserRuntimeIdentityV1;compiler:BrowserCompilerIdentityV1;worker:URL}>()
let loaded:BrowserRuntimeArtifactV1|undefined
export function loadOwnedAuthorBrowserArtifactV1():BrowserRuntimeArtifactV1 {
  if(loaded)return loaded
  const moduleBytes=Object.entries(AUTHOR_BROWSER_MODULES).map(([role,relative])=>({
    role,path:relative,bytes:readFileSync(new URL(relative,ownRoot))}))
  const identities=moduleBytes.map(({path,bytes})=>({path,sha256:authorBrowserAssetSha(bytes)}))
  // This absolute package-relative entry has no Node search or build-tools
  // fallback. The independent component owns the complete published TS lib.
  const typescriptArtifactSha256=authorBrowserAssetSha(readFileSync(
    new URL('node_modules/typescript/lib/typescript.js',ownRoot)))
  const runtime:BrowserRuntimeIdentityV1=Object.freeze({id:'native-author-browser-runtime',version:1,
    implementationSha256:authorBrowserImplementationV1('runtime',identities,typescriptArtifactSha256,BROWSER_PROFILE_V1.sha256),
    capabilityContractSha256:BROWSER_CAPABILITY_CONTRACT_V1.contractSha256})
  const compiler:BrowserCompilerIdentityV1=Object.freeze({id:'native-author-browser-profile-compiler',version:1,
    typescriptVersion:AUTHOR_BROWSER_RUNTIME_PINS.typescript,
    implementationSha256:authorBrowserImplementationV1('compiler',identities,typescriptArtifactSha256,BROWSER_PROFILE_V1.sha256)})
  const child=moduleBytes.find(row=>row.role==='child')!,guard=moduleBytes.find(row=>row.role==='guard')!
  const artifact:BrowserRuntimeArtifactV1=Object.freeze({schemaVersion:1,childJavascript:child.bytes.toString('utf8'),
    childSha256:authorBrowserAssetSha(child.bytes),guardJavascript:guard.bytes.toString('utf8'),
    guardSha256:authorBrowserAssetSha(guard.bytes),identity:runtime})
  ownedArtifacts.set(artifact,{runtime,compiler,worker:new URL(AUTHOR_BROWSER_MODULES['ast-worker'],ownRoot)})
  return loaded=artifact
}
function owned(artifact:BrowserRuntimeArtifactV1) {
  const state=ownedArtifacts.get(artifact)
  if(!state)throw Error('BROWSER_RUNTIME_PRODUCER_NOT_OWNED')
  return state
}
export const ownedBrowserRuntimeIdentityV1=(artifact:BrowserRuntimeArtifactV1)=>owned(artifact).runtime
export const ownedBrowserCompilerIdentityV1=(artifact:BrowserRuntimeArtifactV1)=>owned(artifact).compiler
export const ownedBrowserAstWorkerURLV1=(artifact:BrowserRuntimeArtifactV1)=>new URL(owned(artifact).worker)
