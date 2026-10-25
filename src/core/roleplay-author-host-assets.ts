/** Core admits real Browser/Host5 package bytes before importing either
 * factory. The admitted generation then owns this one lazy lifecycle. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {recordSha256} from './roleplay-data.js'
import type {AdmittedTypeScript} from 'dsh-nexttavern-typescript-runtime'
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
import type {ReleasedRuntimeComponent,ReleasedRuntimeRoles,ReleasedRuntimeRole} from '../operations/released-component-types.mjs'

const browserName=AUTHOR_BROWSER_RUNTIME_NAME_V3,browserVersion=AUTHOR_BROWSER_RUNTIME_VERSION_V3
const hostName='dsh-nexttavern-author-host-runtime-v5-update-batch-v1',hostVersion='0.6.0'
interface AdmittedPackage {
  entry:string
  owned:string
  inventory:{name:string;version:string;files:readonly {path:string;sha256:string}[];generation:string}
  binding?:ReleasedRuntimeComponent
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
  'getDefaultForNewRealm'|'getForVerifiedEpoch'|'getTypeScript'>
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
  const runtimesByIdentity=new Map<string,ProtectedAuthorHostRuntimeV5>()
  type ProductAssets={root:string;require:ReturnType<typeof createRequire>;
    identity:ReturnType<typeof import('../operations/bundled-package-bootstrap.mjs').readBundleIdentity>;
    protection:typeof import('../operations/protected-packages.mjs')}
  let product:Promise<ProductAssets>|undefined
  const current=()=>{if(closed)throw Error('AUTHOR_HOST_RUNTIME_DISPOSED')}
  async function loadProduct():Promise<ProductAssets> {
    const root=productRoot(),require=createRequire(path.join(root,'package.json'))
    const bootstrap=await import(pathToFileURL(path.join(root,'lib/operations/bundled-package-bootstrap.mjs')).href) as
      typeof import('../operations/bundled-package-bootstrap.mjs')
    const protection=await import(pathToFileURL(path.join(root,'lib/operations/protected-packages.mjs')).href) as
      typeof import('../operations/protected-packages.mjs')
    current()
    const identity=bootstrap.readBundleIdentity(root)
    if(identity.productRoot!==root)throw Error('AUTHOR_HOST_INVENTORY_OWNER_CHANGED')
    return {root,require,identity,protection}
  }
  function productAssets():Promise<ProductAssets> {
    // Installed product identity is fixed until this owner is disposed.
    return product??=loadProduct().catch(error=>{product=undefined;throw error})
  }
  async function load(roles?:ReleasedRuntimeRoles,selectedServer?:OwnedMvuSchemaExecutor):Promise<ProtectedAuthorHostRuntimeV5> {
    const {root,require,identity,protection}=await productAssets()
    current()
    const selectedRoles=roles??identity.currentRuntime?.roles
    function admit(role:ReleasedRuntimeRole,fallback:string):AdmittedPackage {
      const ref=selectedRoles?.[role],binding=ref?identity.runtimeComponents.get(ref.name+'\0'+ref.generation+'\0'+(ref.context??'')):undefined
      const name=binding?.name??fallback,historical=binding?.path!==undefined
      const specs=selectedRoles?binding?[binding]:[]:identity.packages.filter(spec=>spec.name===name)
      if(specs.length!==1)throw Error('AUTHOR_HOST_PACKAGE_OWNER_CHANGED')
      const spec=specs[0]!
      const owned=fs.realpathSync(binding?.source??path.join(root,'node_modules',name))
      const metadata=fs.realpathSync(historical?path.join(owned,'package.json'):require.resolve(name+'/package.json'))
      const entry=fs.realpathSync(historical?path.join(owned,'dist','index.mjs'):require.resolve(name))
      if(metadata!==path.join(owned,'package.json')
        ||entry!==path.join(owned,'dist','index.mjs'))throw Error('AUTHOR_HOST_PACKAGE_OWNER_CHANGED')
      protection.verifyProtectedPackage(owned,spec)
      return {entry,owned,binding,inventory:{name,version:spec.version,files:structuredClone(spec.files),generation:spec.generation}}
    }
    const server=selectedServer??await deps.serverAssets.getDefaultForNewRealm(4)
    current()
    if(server.executorVersion!==4||!server.stateLoader)throw Error('AUTHOR_HOST_SERVER_ABI_UNSUPPORTED')
    async function loadBrowser(role:'browser'|'browserPartition') {
      const admittedBrowser=admit(role,browserName)
      const factory=admittedBrowser.binding?.factory??'browser-v3-shared-typescript'
      if(factory==='browser-v3-shared-typescript') {
        const browserModule=await import(pathToFileURL(admittedBrowser.entry).href) as {
          createOwnedAuthorBrowserRuntimeV3(deps:{verifyOwnedPackage:ReturnType<typeof packageVerifier>;
            typescript:AdmittedTypeScript}):Promise<OwnedAuthorBrowserRuntimeV3>
        }
        if(admittedBrowser.binding&&!admittedBrowser.binding.dependencies.typescript)
          throw Error('AUTHOR_HOST_TYPESCRIPT_UNAVAILABLE')
        const typescript=await deps.serverAssets.getTypeScript(admittedBrowser.binding?.dependencies.typescript)
        current()
        return browserModule.createOwnedAuthorBrowserRuntimeV3({
          verifyOwnedPackage:packageVerifier(admittedBrowser),typescript})
      }
      if(factory!=='browser-v2-local-typescript')throw Error('AUTHOR_HOST_BROWSER_ABI_UNSUPPORTED')
      // The published Browser2 factory owns its package-local compiler.
      const browserModule=await import(pathToFileURL(admittedBrowser.entry).href) as {
        createOwnedAuthorBrowserRuntimeV2(deps:{verifyOwnedPackage:ReturnType<typeof packageVerifier>}):
          Promise<OwnedAuthorBrowserRuntimeV2>
      }
      current()
      const dependency={verifyOwnedPackage:packageVerifier(admittedBrowser)}
      return browserModule.createOwnedAuthorBrowserRuntimeV2(dependency)
    }
    const browser=await loadBrowser('browser')
    let browserPartition:OwnedAuthorBrowserRuntimeV2|undefined
    let host:AuthorHostRuntimeV5|undefined,prompt:OwnedAuthorPromptRuntimeV1|undefined
    try {
      current()
      if(selectedRoles?.browserPartition) {
        browserPartition=await loadBrowser('browserPartition') as OwnedAuthorBrowserRuntimeV2
      }
      current()
      const admittedPrompt=admit('prompt',AUTHOR_PROMPT_RUNTIME_NAME)
      if(admittedPrompt.binding&&(admittedPrompt.binding.factory!=='prompt-v1-shared-typescript'
        ||!admittedPrompt.binding.dependencies.typescript))throw Error('AUTHOR_HOST_PROMPT_ABI_UNSUPPORTED')
      prompt=await loadAdmittedAuthorPromptRuntimeV1({...admittedPrompt,inventory:{...admittedPrompt.inventory,
        name:AUTHOR_PROMPT_RUNTIME_NAME,version:admittedPrompt.inventory.version as typeof AUTHOR_PROMPT_RUNTIME_VERSION}},
      current,await deps.serverAssets.getTypeScript(admittedPrompt.binding?.dependencies.typescript))
      current()
      const admittedHost=admit('host',hostName)
      if(admittedHost.binding&&admittedHost.binding.factory!=='host-v5')throw Error('AUTHOR_HOST_ABI_UNSUPPORTED')
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
  async function admitted(roles?:ReleasedRuntimeRoles,server?:OwnedMvuSchemaExecutor,key='default')
    :Promise<ProtectedAuthorHostRuntimeV5> {
    current()
    // A frozen Host package is shared by distinct injected Browser/server
    // tuples. Historical identity, rather than its package name, owns reuse.
    let pending=runtimes.get(key)
    if(!pending) {
      pending=load(roles,server)
        .then(runtime=>{
          runtimesByIdentity.set(runtime.implementationKey+':'+recordSha256(runtime.host.server),runtime)
          return runtime
        })
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
      current()
      try {
        // Compute both lookup identities before admission yields. A persisted
        // tuple is DATA only, including the real stateLoader member.
        const hostKey=recordSha256(identity),serverKey=recordSha256(server)
        const known=runtimesByIdentity.get(hostKey+':'+serverKey)
        if(known){known.host.checkCurrent();return known}
        const {identity:catalog}=await productAssets()
        current()
        const entry=catalog.releasedRuntime?.authors.find(row=>
          recordSha256(row.host)===hostKey&&recordSha256(row.server)===serverKey)
        const selectedServer=entry?await deps.serverAssets.getForVerifiedEpoch({compiler:server.compiler,
          bridge:server.bridge,libraries:server.libraries,runner:server.runner}):undefined
        const runtime=await admitted(entry?.roles,selectedServer,entry?hostKey+':'+serverKey:'default')
        if(runtime.implementationKey!==hostKey||recordSha256(runtime.host.server)!==serverKey) {
          throw Error('AUTHOR_HOST_HISTORY_UNAVAILABLE')
        }
        return runtime
      }catch {current();throw Error('AUTHOR_HOST_HISTORY_UNAVAILABLE')}
    },dispose,
  }
}
