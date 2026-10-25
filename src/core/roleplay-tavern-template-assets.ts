/** Own the independent template component's product admission and lazy
 * lifecycle. Source/scopes/lore/Native permission remain with the caller.
 * No profile/build-tools path or schema executor supplies this component. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {recordSha256} from './roleplay-data.js'
import type {TavernTemplateRuntimeV1,TavernTemplateOwnedInventoryV1,TavernTemplateCurrentRuntimeV1}
  from './tavern-template-types.mjs'
import type {TavernTemplateEngineIdentityV1} from './tavern-template-types.mjs'
import type {ReleasedComponentRef} from '../operations/released-component-types.mjs'

const NAME='dsh-nexttavern-template-runtime-v2'
const VERSION='0.1.0'
type TemplatePackageName=TavernTemplateEngineIdentityV1['packageName']
// This actual Core asset-owner module instance only. The rejection count does
// not transfer runtime frames or provide a process-wide lock/approval token.
let ownedReadScopeDepth=0
function owningProductRoot():string {
  // Exactly the two already registered root/preset Core delivery layouts.
  for(const relative of ['../../','../../../']) {
    const root=fs.realpathSync(fileURLToPath(new URL(relative,import.meta.url)))
    const file=path.join(root,'package.json')
    if(!fs.existsSync(file))continue
    const metadata=JSON.parse(fs.readFileSync(file,'utf8')) as {name?:string;dependencies?:Record<string,string>}
    if(metadata.name==='dsh-nexttavern'&&metadata.dependencies?.[NAME]===VERSION)return root
  }
  throw Error('TEMPLATE_RUNTIME_PRODUCT_OWNER_UNAVAILABLE')
}
export interface AdmittedTavernTemplateComponentV1 {
  readonly runtime:TavernTemplateRuntimeV1
  readonly inventory:TavernTemplateOwnedInventoryV1
  /** The actual admitted runtime is still alive in its loaded generation. */
  verify():void
  /** Loaded availability only; Source/input permission belongs to Core. */
  observe():void
  /** Compatibility synchronous guard; owns no filesystem verification frame. */
  checkCurrentSync(checks:()=>void):void
}
export function createRoleplayTavernTemplateAssetOwnerV1() {
  let closed=false
  let defaultKey='default'
  const instances=new Map<string,{
    pending?:Promise<AdmittedTavernTemplateComponentV1>
    admitted?:AdmittedTavernTemplateComponentV1
    runtime?:TavernTemplateCurrentRuntimeV1
  }>()
  type ProductAssets={root:string;require:ReturnType<typeof createRequire>;
    identity:ReturnType<typeof import('../operations/bundled-package-bootstrap.mjs').readBundleIdentity>;
    protection:typeof import('../operations/protected-packages.mjs')}
  let product:Promise<ProductAssets>|undefined
  async function productAssets():Promise<ProductAssets> {
    return product??=(async()=>{
      const root=owningProductRoot(),require=createRequire(path.join(root,'package.json'))
      const bootstrap=await import(pathToFileURL(path.join(root,'lib/operations/bundled-package-bootstrap.mjs')).href) as
        typeof import('../operations/bundled-package-bootstrap.mjs')
      const protection=await import(pathToFileURL(path.join(root,'lib/operations/protected-packages.mjs')).href) as
        typeof import('../operations/protected-packages.mjs')
      return {root,require,identity:bootstrap.readBundleIdentity(root),protection}
    })().catch(error=>{product=undefined;throw error})
  }
  function checkCurrentSync(checks:()=>void,selectedRuntime?:TavernTemplateCurrentRuntimeV1):void {
    if(closed)throw Error('TEMPLATE_RUNTIME_DISPOSED')
    ownedReadScopeDepth++
    try {
      // Only internal synchronous read/assert guards use this scope. It never
      // encloses code loading, persistence, worker or provider dispatch.
      const currentRuntime=selectedRuntime??instances.get(defaultKey)?.runtime
      if(currentRuntime){currentRuntime.checkCurrentSync(checks);return}
      const returned=checks() as unknown
      if(returned&&typeof returned==='object'&&'then' in returned) {
        throw Error('TEMPLATE_RUNTIME_ASYNC_VERIFICATION_SCOPE')
      }
      if(closed)throw Error('TEMPLATE_RUNTIME_DISPOSED')
    } finally {ownedReadScopeDepth--}
  }
  async function load(key:string,ref?:ReleasedComponentRef):Promise<AdmittedTavernTemplateComponentV1> {
    const {root,require,identity,protection}=await productAssets()
    const binding=ref?identity.runtimeComponents.get(ref.name+'\0'+ref.generation+'\0'+(ref.context??'')):undefined
    if(ref&&(!binding||binding.factory!=='template-v2'))throw Error('TEMPLATE_RUNTIME_ENGINE_UNAVAILABLE')
    const name=(binding?.name??NAME) as TemplatePackageName,historical=binding?.path!==undefined
    const metadataPath=fs.realpathSync(historical?path.join(binding!.source,'package.json'):require.resolve(name+'/package.json'))
    const ownedDirectory=binding?.source??path.join(root,'node_modules',name),ownedStat=fs.lstatSync(ownedDirectory)
    if(!ownedStat.isDirectory()||ownedStat.isSymbolicLink())throw Error('TEMPLATE_RUNTIME_PACKAGE_OWNER_CHANGED')
    const owned=fs.realpathSync(ownedDirectory)
    if(owned!==path.resolve(ownedDirectory))throw Error('TEMPLATE_RUNTIME_PACKAGE_OWNER_CHANGED')
    if(metadataPath!==path.join(owned,'package.json'))throw Error('TEMPLATE_RUNTIME_PACKAGE_OWNER_CHANGED')
    const entry=fs.realpathSync(historical?path.join(owned,'dist/index.mjs'):require.resolve(name))
    if(entry!==path.join(owned,'dist','index.mjs'))throw Error('TEMPLATE_RUNTIME_ENTRY_OWNER_CHANGED')
    const readInventory=()=>{
      if(closed)throw Error('TEMPLATE_RUNTIME_DISPOSED')
      const rows=binding?[binding]:identity.packages.filter(row=>row.name===name)
      if(identity.productRoot!==root||rows.length!==1||!binding&&rows[0]!.version!==VERSION
        ||!historical&&(fs.realpathSync(require.resolve(name+'/package.json'))!==metadataPath
        ||fs.realpathSync(path.join(root,'node_modules',name))!==owned
        ||fs.realpathSync(require.resolve(name))!==entry))throw Error('TEMPLATE_RUNTIME_INVENTORY_OWNER_CHANGED')
      const row=rows[0]!
      if(protection.protectedGeneration(row)!==row.generation)throw Error('TEMPLATE_RUNTIME_GENERATION_CHANGED')
      return row
    }
    const readOwnedInventory=():TavernTemplateOwnedInventoryV1=>{
      const row=readInventory()
      return {name,version:row.version,files:structuredClone(row.files),generation:row.generation}
    }
    // Runtime code cannot protect its own import. Keep the original generic
    // full verification before loading it; ordinary installer APIs stay intact.
    const initial=readOwnedInventory(),initialGeneration=initial.generation
    protection.verifyProtectedPackage(owned,{name:initial.name,version:initial.version,
      files:initial.files.map(file=>({path:file.path,sha256:file.sha256}))})
    const verifyOwnedPackage=(url:URL):TavernTemplateOwnedInventoryV1=>{
      if(url.protocol!=='file:'||fs.realpathSync(fileURLToPath(url))!==owned) {
        throw Error('TEMPLATE_RUNTIME_PACKAGE_OWNER_CHANGED')
      }
      if(closed)throw Error('TEMPLATE_RUNTIME_DISPOSED')
      // Only factory admission calls this callback. Its full package scan
      // fixes one loaded generation for the resulting runtime's lifetime.
      const current=readOwnedInventory()
      if(current.generation!==initialGeneration)throw Error('TEMPLATE_RUNTIME_GENERATION_CHANGED')
      return current
    }
    if(closed)throw Error('TEMPLATE_RUNTIME_DISPOSED')
    const factory=await import(pathToFileURL(entry).href) as typeof import('./tavern-template-provider.mjs')
    if(closed)throw Error('TEMPLATE_RUNTIME_DISPOSED')
    const runtime=await factory.createOwnedTavernTemplateRuntimeV1({verifyOwnedPackage})
    try {
      if(closed)throw Error('TEMPLATE_RUNTIME_DISPOSED')
      if(typeof runtime.checkCurrent!=='function'||typeof runtime.checkCurrentSync!=='function'
        ||typeof runtime.invalidateCurrent!=='function'||typeof runtime.assertCurrentScopeInactive!=='function') {
        throw Error('TEMPLATE_RUNTIME_IMPLEMENTATION_CHANGED')
      }
      runtime.checkCurrent()
      if(runtime.identity.packageName!==name||runtime.identity.packageVersion!==initial.version
        ||runtime.identity.protectedGeneration!==initialGeneration)throw Error('TEMPLATE_RUNTIME_IMPLEMENTATION_CHANGED')
      const result=Object.freeze({runtime,inventory:initial,
        verify:()=>{runtime.checkCurrent()},
        observe:()=>{runtime.checkCurrent()},checkCurrentSync:(checks:()=>void)=>checkCurrentSync(checks,runtime)})
      const state=instances.get(key)!
      state.runtime=runtime
      state.admitted=result
      return result
    } catch(error) {
      await runtime.dispose()
      throw error
    }
  }
  async function loadSelected(engine?:TavernTemplateEngineIdentityV1,signal?:AbortSignal) {
    if(closed)throw Error('TEMPLATE_RUNTIME_DISPOSED')
    signal?.throwIfAborted()
    if(ownedReadScopeDepth)throw Error('TEMPLATE_EXECUTION_IN_VERIFICATION_SCOPE')
    const {identity}=await productAssets()
    if(closed)throw Error('TEMPLATE_RUNTIME_DISPOSED')
    const historical=engine?identity.releasedRuntime?.templates.find(row=>recordSha256(row.engine)===recordSha256(engine)):undefined
    const ref=historical?.component??identity.currentRuntime?.roles.template
    // A tuple not in the release catalog can only match the current component.
    // Full identity equality below rejects unsupported or unreleased requests.
    if(engine&&engine.packageName!==NAME)throw Error('TEMPLATE_RUNTIME_ENGINE_UNAVAILABLE')
    const key=ref?ref.name+'\0'+ref.generation+'\0'+(ref.context??''):'default'
    const current=identity.currentRuntime?.roles.template
    if(!historical||current&&ref?.name===current.name&&ref.generation===current.generation
      &&ref.context===current.context)defaultKey=key
    const state=instances.get(key)??{}
    if(!instances.has(key))instances.set(key,state)
    state.runtime?.assertCurrentScopeInactive()
    if(!state.pending){state.pending=load(key,ref);void state.pending.catch(()=>{if(!closed)state.pending=undefined})}
    const result=await state.pending
    signal?.throwIfAborted()
    if(closed)throw Error('TEMPLATE_RUNTIME_DISPOSED')
    result.verify()
    return result
  }
  return {
    checkCurrentSync,
    /** Admission already captured the product/component generation. Later
     * availability checks consult only the actual runtime's lifetime. */
    observeAdmitted():AdmittedTavernTemplateComponentV1|undefined {
      const admitted=instances.get(defaultKey)?.admitted
      if(closed||!admitted)return undefined
      admitted.observe()
      return admitted
    },
    current():AdmittedTavernTemplateComponentV1|undefined {
      const admitted=instances.get(defaultKey)?.admitted
      if(closed||!admitted)return undefined
      admitted.verify()
      return admitted
    },
    async load(signal?:AbortSignal):Promise<AdmittedTavernTemplateComponentV1> {
      return loadSelected(undefined,signal)
    },
    async loadForEngine(engine:TavernTemplateEngineIdentityV1,signal?:AbortSignal)
      :Promise<AdmittedTavernTemplateComponentV1> {
      const result=await loadSelected(engine,signal)
      // An old closure must execute under its creating implementation, rather
      // than merely another component with the same wire protocol.
      if(recordSha256(result.runtime.identity)!==recordSha256(engine))throw Error('TEMPLATE_RUNTIME_ENGINE_UNAVAILABLE')
      return result
    },
    async dispose():Promise<void> {
      if(ownedReadScopeDepth)throw Error('TEMPLATE_EXECUTION_IN_VERIFICATION_SCOPE')
      for(const state of instances.values())state.runtime?.assertCurrentScopeInactive()
      closed=true
      for(const state of instances.values())state.runtime?.invalidateCurrent()
      // Await an in-flight factory: its own post-await guard disposes any late
      // runtime before rejecting; cancellation cannot leave a worker owner.
      const results=await Promise.allSettled([...instances.values()].map(async state=>{
        const result=state.admitted??await state.pending?.catch(()=>undefined)
        await result?.runtime.dispose()
      }))
      const failure=results.find(result=>result.status==='rejected')
      if(failure?.status==='rejected')throw failure.reason
    },
  }
}
