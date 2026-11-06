/** Core admits real Host5 package bytes before importing its
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
import {EJS_RUNTIME_PACKAGE} from './tavern-template-ejs-runtime-types.mjs'
import type {TavernEjsRuntime} from './tavern-template-ejs-runtime-types.mjs'
import type {TavernEjsReplayEngine} from './tavern-template-ejs-replay.mjs'
import type {ReleasedRuntimeComponent,ReleasedRuntimeRoles,ReleasedRuntimeRole} from '../operations/released-component-types.mjs'

const hostName='dsh-nexttavern-author-host-runtime-v5-update-batch-v1'
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
}
export type AuthorHostServerAssetsV5=Pick<ReturnType<typeof createRoleplayMvuSchemaAssetOwner>,
  'getDefaultForNewRealm'|'getForVerifiedEpoch'|'getTypeScript'>
function productRoot():string {
  // These are the registered root/lib/core and preset/lib/core deliveries.
  for(const relative of ['../../','../../../']) {
    const root=fs.realpathSync(fileURLToPath(new URL(relative,import.meta.url)))
    const metadata=path.join(root,'package.json')
    if(!fs.existsSync(metadata))continue
    const product=JSON.parse(fs.readFileSync(metadata,'utf8')) as {name?:string}
    if(product.name==='dsh-nexttavern')return root
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
  const ejsRuntimes=new Map<string,{pending:Promise<TavernEjsRuntime>;runtime?:TavernEjsRuntime}>()
  let defaultEjsKey:string|undefined
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
  function admit(assets:ProductAssets,roles:ReleasedRuntimeRoles|undefined,
    role:ReleasedRuntimeRole,fallback:string):AdmittedPackage {
    const {root,require,identity,protection}=assets
    const ref=roles?.[role],binding=ref?identity.runtimeComponents.get(ref.name+'\0'+ref.generation+'\0'+(ref.context??'')):undefined
    const name=binding?.name??fallback,historical=binding?.path!==undefined
    const specs=roles?binding?[binding]:[]:identity.packages.filter(spec=>spec.name===name)
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
  async function load(roles?:ReleasedRuntimeRoles,selectedServer?:OwnedMvuSchemaExecutor):Promise<ProtectedAuthorHostRuntimeV5> {
    const assets=await productAssets(),{identity}=assets
    current()
    const selectedRoles=roles??identity.currentRuntime?.roles
    const server=selectedServer??await deps.serverAssets.getDefaultForNewRealm(4)
    current()
    if(server.executorVersion!==4||!server.stateLoader)throw Error('AUTHOR_HOST_SERVER_ABI_UNSUPPORTED')
    let host:AuthorHostRuntimeV5|undefined
    try {
      current()
      const admittedHost=admit(assets,selectedRoles,'host',hostName)
      if(admittedHost.binding&&admittedHost.binding.factory!=='host-v5')throw Error('AUTHOR_HOST_ABI_UNSUPPORTED')
      const hostModule=await import(pathToFileURL(admittedHost.entry).href) as {
        createOwnedAuthorHostRuntimeV5(deps:{verifyOwnedPackage:ReturnType<typeof packageVerifier>;
          server:AdmittedAuthorServerV4}):Promise<AuthorHostRuntimeV5>
      }
      current()
      host=await hostModule.createOwnedAuthorHostRuntimeV5({
        verifyOwnedPackage:packageVerifier(admittedHost),
        server:server as AdmittedAuthorServerV4})
      current()
      return Object.freeze({executorVersion:4 as const,compiler:server.compiler,runner:server.runner,
        bridge:server.bridge,libraries:server.libraries,stateLoader:server.stateLoader,
        implementationKey:recordSha256(host.identity),host,dispose})
    }catch(error) {
      host?.dispose()
      throw error
    }
  }
  async function admitted(roles?:ReleasedRuntimeRoles,server?:OwnedMvuSchemaExecutor,key='default')
    :Promise<ProtectedAuthorHostRuntimeV5> {
    current()
    // A frozen Host package is shared by distinct injected server
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
  async function getEjs(engine?:TavernEjsReplayEngine,signal?:AbortSignal):Promise<TavernEjsRuntime> {
    current();signal?.throwIfAborted()
    const assets=await productAssets(),identity=assets.identity
    current()
    const selected=engine?identity.releasedRuntime?.templateEjs?.find(row=>
      recordSha256(row.engine)===recordSha256(engine))?.component:undefined
    const ref=selected??identity.currentRuntime?.roles.templateEjs
    if(!ref)throw Error('TEMPLATE_EJS_ENGINE_UNAVAILABLE')
    const key=ref.name+'\0'+ref.generation+'\0'+(ref.context??'')
    const defaultRef=identity.currentRuntime?.roles.templateEjs
    // A historical replay may admit another generation without making that
    // instance available to a fresh opening under today's current role.
    if(defaultRef&&ref.name===defaultRef.name&&ref.generation===defaultRef.generation
      &&ref.context===defaultRef.context)defaultEjsKey=key
    let state=ejsRuntimes.get(key)
    if(!state) {
      const pending=(async()=>{
        const owned=admit(assets,{templateEjs:ref},'templateEjs',EJS_RUNTIME_PACKAGE)
        if(owned.binding?.factory!=='template-ejs-v1')throw Error('TEMPLATE_EJS_ENGINE_UNAVAILABLE')
        const module=await import(pathToFileURL(owned.entry).href) as typeof import('./tavern-template-ejs-runtime-provider.mjs')
        current()
        const runtime=await module.createOwnedTavernEjsRuntimeV1({verifyOwnedPackage:root=>{
          current();return packageVerifier(owned)(root)
        }})
        try {current();runtime.current();return runtime}
        catch(error) {await runtime.dispose();throw error}
      })().then(runtime=>{ejsRuntimes.get(key)!.runtime=runtime;return runtime})
        .catch(error=>{ejsRuntimes.delete(key);throw error})
      state={pending}
      ejsRuntimes.set(key,state)
    }
    const runtime=await state.pending
    current();signal?.throwIfAborted();runtime.current()
    if(engine&&recordSha256(runtime.identity)!==recordSha256(engine))throw Error('TEMPLATE_EJS_ENGINE_UNAVAILABLE')
    return runtime
  }
  function currentEjs():TavernEjsRuntime|undefined {
    if(closed||defaultEjsKey===undefined)return undefined
    const runtime=ejsRuntimes.get(defaultEjsKey)?.runtime
    runtime?.current()
    return runtime
  }
  function checkEjsCurrentSync(checks:()=>void):void {
    current()
    const runtime=defaultEjsKey===undefined?undefined:ejsRuntimes.get(defaultEjsKey)?.runtime
    if(!runtime)throw Error('TEMPLATE_EJS_ENGINE_UNAVAILABLE')
    runtime.checkCurrentSync(checks)
    current()
  }
  function dispose():Promise<void> {
    if(disposal)return disposal
    closed=true
    return disposal=(async()=>{
      await Promise.all([...runtimes.values()].map(async pending=>{
        try {
          const runtime=await pending
          runtime.host.dispose()
        }catch { /* A revoked load cleans up its own created factories. */ }
      }))
      await Promise.all([...ejsRuntimes.values()].map(async state=>{
        const runtime=await state.pending.catch(()=>undefined)
        await runtime?.dispose()
      }))
      // The injected server asset owner retains its independent ABI1–4 lifetime.
    })()
  }
  return {
    getDefault:()=>admitted(),getEjs,currentEjs,checkEjsCurrentSync,
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
