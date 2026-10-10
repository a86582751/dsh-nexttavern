/** Core admits real Browser/Host5 package bytes before importing either
 * factory. The admitted generation then owns this one lazy lifecycle. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {recordSha256} from './roleplay-data.js'
import type {createRoleplayMvuSchemaAssetOwner} from './roleplay-mvu-schema-assets.js'
import type {OwnedMvuSchemaExecutor} from './roleplay-mvu-schema-executor-types.js'
import type {AuthorHostIdentityV5,AuthorServerExecutorV4} from './roleplay-author-host-types-v5.js'
import type {AuthorHostRuntimeV5,AdmittedAuthorServerV4}
  from './tavern-author-host-provider.mjs'
import type {OwnedAuthorBrowserRuntimeV1} from './tavern-author-browser-types.mjs'
import type {OwnedAuthorBrowserRuntimeV2} from './tavern-author-browser-types-v2.mjs'
import type {OwnedAuthorBrowserRuntimeV3} from './tavern-author-browser-types-v3.mjs'
import {AUTHOR_BROWSER_RUNTIME_NAME_V3,AUTHOR_BROWSER_RUNTIME_VERSION_V3}
  from './tavern-author-browser-descriptor-v3.mjs'
import type {OwnedAuthorPromptRuntimeV1} from './tavern-author-prompt-types.mjs'
import {AUTHOR_PROMPT_RUNTIME_NAME,AUTHOR_PROMPT_RUNTIME_VERSION} from './tavern-author-prompt-descriptor.mjs'
import {loadAdmittedAuthorPromptRuntimeV1} from './roleplay-author-prompt-assets.js'

const browserName=AUTHOR_BROWSER_RUNTIME_NAME_V3,browserVersion=AUTHOR_BROWSER_RUNTIME_VERSION_V3
const hostName='dsh-nexttavern-author-host-runtime-v5-server-candidates-v2',hostVersion='0.5.2'
interface AdmittedPackage {
  entry:string
  owned:string
  inventory:{name:string;version:string;files:readonly {path:string;sha256:string}[];generation:string}
}
export type ProtectedAuthorHostRuntimeV5=OwnedMvuSchemaExecutor&{
  executorVersion:4
  stateLoader:AuthorServerExecutorV4['stateLoader']
  host:AuthorHostRuntimeV5
  browser:OwnedAuthorBrowserRuntimeV1|OwnedAuthorBrowserRuntimeV2|OwnedAuthorBrowserRuntimeV3
  browserPartition?:OwnedAuthorBrowserRuntimeV2
  readonly prompt:OwnedAuthorPromptRuntimeV1
}
export type AuthorHostServerAssetsV5=Pick<ReturnType<typeof createRoleplayMvuSchemaAssetOwner>,
  'getDefaultForNewRealm'|'getForVerifiedEpoch'>
function productRoot():string {
  // These are the registered root/lib/core and preset/lib/core deliveries.
  for(const relative of ['../../','../../../']) {
    const root=fs.realpathSync(fileURLToPath(new URL(relative,import.meta.url)))
    const metadata=path.join(root,'package.json')
    if(!fs.existsSync(metadata))continue
    const product=JSON.parse(fs.readFileSync(metadata,'utf8')) as {name?:string;dependencies?:Record<string,string>}
    if(product.name==='dsh-nexttavern'&&product.dependencies?.[browserName]===browserVersion
      &&product.dependencies?.[hostName]===hostVersion
      &&product.dependencies?.[AUTHOR_PROMPT_RUNTIME_NAME]===AUTHOR_PROMPT_RUNTIME_VERSION)return root
  }
  throw Error('AUTHOR_HOST_PRODUCT_OWNER_UNAVAILABLE')
}
function packageVerifier(admitted:AdmittedPackage) {
  return (root:URL)=>{
    if(root.protocol!=='file:'||fs.realpathSync(fileURLToPath(root))!==admitted.owned) {
      throw Error('AUTHOR_HOST_PACKAGE_OWNER_CHANGED')
    }
    // The factory consumes this exact preimport admission. It does not scan
    // the installed tree again or treat bundle metadata as byte verification.
    return admitted.inventory
  }
}

export function createRoleplayAuthorHostAssetOwner(deps:{serverAssets:AuthorHostServerAssetsV5}) {
  let closed=false,disposal:Promise<void>|undefined
  const runtimes=new Map<string,Promise<ProtectedAuthorHostRuntimeV5>>()
  const current=()=>{if(closed)throw Error('AUTHOR_HOST_RUNTIME_DISPOSED')}
  async function load(name:string,selectedServer?:OwnedMvuSchemaExecutor,
    selectedBrowser=browserName,selectedPartition:string|undefined=undefined,
    hostComponent?:string,browserComponent?:string,promptComponent?:string):Promise<ProtectedAuthorHostRuntimeV5> {
    const root=productRoot(),require=createRequire(path.join(root,'package.json'))
    const bootstrap=await import(pathToFileURL(path.join(root,'lib/operations/bundled-package-bootstrap.mjs')).href) as
      typeof import('../operations/bundled-package-bootstrap.mjs')
    const protection=await import(pathToFileURL(path.join(root,'lib/operations/protected-packages.mjs')).href) as
      typeof import('../operations/protected-packages.mjs')
    current()
    const identity=bootstrap.readBundleIdentity(root)
    if(identity.productRoot!==root)throw Error('AUTHOR_HOST_INVENTORY_OWNER_CHANGED')
    function admit(name:string,component?:string):AdmittedPackage {
      const historical=component===undefined?undefined:identity.historicalComponents.find(spec=>spec.path===component)
      const specs=historical?[historical]:component===undefined?identity.packages.filter(spec=>spec.name===name):[]
      if(specs.length!==1||specs[0]!.name!==name)throw Error('AUTHOR_HOST_PACKAGE_OWNER_CHANGED')
      const spec=specs[0]!
      const owned=fs.realpathSync(historical?.source??path.join(root,'node_modules',name))
      const metadata=fs.realpathSync(historical?path.join(owned,'package.json'):require.resolve(name+'/package.json'))
      const entry=fs.realpathSync(historical?path.join(owned,'dist','index.mjs'):require.resolve(name))
      if(metadata!==path.join(owned,'package.json')
        ||entry!==path.join(owned,'dist','index.mjs'))throw Error('AUTHOR_HOST_PACKAGE_OWNER_CHANGED')
      protection.verifyProtectedPackage(owned,spec)
      return {entry,owned,inventory:{name,version:spec.version,files:structuredClone(spec.files),generation:spec.generation}}
    }
    const server=selectedServer??await deps.serverAssets.getDefaultForNewRealm(4)
    current()
    if(server.executorVersion!==4||!server.stateLoader)throw Error('AUTHOR_HOST_SERVER_ABI_UNSUPPORTED')
    async function loadBrowser(selected:string,component?:string) {
      const admittedBrowser=admit(selected,component)
      const browserModule=await import(pathToFileURL(admittedBrowser.entry).href) as {
        createOwnedAuthorBrowserRuntimeV1?(deps:{verifyOwnedPackage:ReturnType<typeof packageVerifier>}):
          Promise<OwnedAuthorBrowserRuntimeV1>
        createOwnedAuthorBrowserRuntimeV2?(deps:{verifyOwnedPackage:ReturnType<typeof packageVerifier>}):
          Promise<OwnedAuthorBrowserRuntimeV2>
        createOwnedAuthorBrowserRuntimeV3?(deps:{verifyOwnedPackage:ReturnType<typeof packageVerifier>}):
          Promise<OwnedAuthorBrowserRuntimeV3>
      }
      current()
      const dependency={verifyOwnedPackage:packageVerifier(admittedBrowser)}
      if(browserModule.createOwnedAuthorBrowserRuntimeV3)return browserModule.createOwnedAuthorBrowserRuntimeV3(dependency)
      if(browserModule.createOwnedAuthorBrowserRuntimeV2)return browserModule.createOwnedAuthorBrowserRuntimeV2(dependency)
      return browserModule.createOwnedAuthorBrowserRuntimeV1!(dependency)
    }
    const browser=await loadBrowser(selectedBrowser,browserComponent)
    let browserPartition:OwnedAuthorBrowserRuntimeV2|undefined
    let host:AuthorHostRuntimeV5|undefined,prompt:OwnedAuthorPromptRuntimeV1|undefined
    try {
      current()
      if(selectedPartition)browserPartition=await loadBrowser(selectedPartition) as OwnedAuthorBrowserRuntimeV2
      current()
      const admittedPrompt=admit(AUTHOR_PROMPT_RUNTIME_NAME,promptComponent)
      prompt=await loadAdmittedAuthorPromptRuntimeV1({...admittedPrompt,inventory:{...admittedPrompt.inventory,
        name:AUTHOR_PROMPT_RUNTIME_NAME,version:admittedPrompt.inventory.version as typeof AUTHOR_PROMPT_RUNTIME_VERSION}},current)
      current()
      const admittedHost=admit(name,hostComponent)
      const hostModule=await import(pathToFileURL(admittedHost.entry).href) as {
        createOwnedAuthorHostRuntimeV5(deps:{verifyOwnedPackage:ReturnType<typeof packageVerifier>;
          server:AdmittedAuthorServerV4;browser:OwnedAuthorBrowserRuntimeV1|OwnedAuthorBrowserRuntimeV2|OwnedAuthorBrowserRuntimeV3;
          browserPartition?:OwnedAuthorBrowserRuntimeV2;
          prompt:OwnedAuthorPromptRuntimeV1}):Promise<AuthorHostRuntimeV5>
      }
      current()
      host=await hostModule.createOwnedAuthorHostRuntimeV5({
        verifyOwnedPackage:packageVerifier(admittedHost),
        server:server as AdmittedAuthorServerV4,browser,...browserPartition?{browserPartition}:{},prompt})
      current()
      return Object.freeze({executorVersion:4 as const,compiler:server.compiler,runner:server.runner,
        bridge:server.bridge,libraries:server.libraries,stateLoader:server.stateLoader,
        implementationKey:recordSha256(host.identity),host,browser,...browserPartition?{browserPartition}:{},prompt,dispose})
    }catch(error) {
      host?.dispose()
      await Promise.all([browser.dispose(),browserPartition?.dispose(),prompt?.dispose()])
      throw error
    }
  }
  async function admitted(name=hostName,server?:OwnedMvuSchemaExecutor,
    selectedBrowser=browserName,selectedPartition:string|undefined=undefined,
    key='default',hostComponent?:string,browserComponent?:string,promptComponent?:string):Promise<ProtectedAuthorHostRuntimeV5> {
    current()
    // A frozen Host package is shared by distinct injected Browser/server
    // tuples. Historical identity, rather than its package name, owns reuse.
    let pending=runtimes.get(key)
    if(!pending) {
      pending=load(name,server,selectedBrowser,selectedPartition,hostComponent,browserComponent,promptComponent)
        .catch(error=>{runtimes.delete(key);throw error})
      runtimes.set(key,pending)
    }
    const runtime=await pending
    current();runtime.host.checkCurrent()
    return runtime
  }
  function dispose():Promise<void> {
    if(disposal)return disposal
    closed=true
    return disposal=(async()=>{
      await Promise.all([...runtimes.values()].map(async pending=>{
        try {
          const runtime=await pending
          runtime.host.dispose()
          await Promise.all([runtime.browser.dispose(),runtime.browserPartition?.dispose(),runtime.prompt.dispose()])
        }catch { /* A revoked load cleans up its own created factories. */ }
      }))
      // The injected server asset owner retains its independent ABI1–4 lifetime.
    })()
  }
  return {
    getDefault:()=>admitted(),
    async getForVerifiedHost(identity:AuthorHostIdentityV5,server:AuthorServerExecutorV4):Promise<ProtectedAuthorHostRuntimeV5> {
      try {
        // Compute both lookup identities before admission yields. A persisted
        // tuple is DATA only, including the real stateLoader member.
        const hostKey=recordSha256(identity),serverKey=recordSha256(server)
        const root=productRoot()
        const bootstrap=await import(pathToFileURL(path.join(root,'lib/operations/bundled-package-bootstrap.mjs')).href) as
          typeof import('../operations/bundled-package-bootstrap.mjs')
        const entry=bootstrap.readBundleIdentity(root).authorRuntimeHistory.find(row=>
          recordSha256(row.host)===hostKey&&recordSha256(row.server)===serverKey)
        const selectedServer=entry?await deps.serverAssets.getForVerifiedEpoch({compiler:server.compiler,
          bridge:server.bridge,libraries:server.libraries,runner:server.runner}):undefined
        const runtime=await admitted(entry?.hostPackage,selectedServer,entry?.browserPackage,entry?.browserPartitionPackage,
          entry?hostKey+':'+serverKey:'default',entry?.hostComponent,entry?.browserComponent,entry?.promptComponent)
        if(runtime.implementationKey!==hostKey||recordSha256(runtime.host.server)!==serverKey) {
          throw Error('AUTHOR_HOST_HISTORY_UNAVAILABLE')
        }
        return runtime
      }catch {throw Error('AUTHOR_HOST_HISTORY_UNAVAILABLE')}
    },dispose,
  }
}
