/** Own the independent template component's product admission and lazy
 * lifecycle. Source/scopes/lore/Native permission remain with the caller.
 * No profile/build-tools path or schema executor supplies this component. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
import type {TavernTemplateRuntimeV1,TavernTemplateOwnedInventoryV1,TavernTemplateCurrentRuntimeV1}
  from './tavern-template-types.mjs'

const NAME='dsh-nexttavern-template-runtime-v1'
const VERSION='0.1.0'
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
  let pending:Promise<AdmittedTavernTemplateComponentV1>|undefined
  let admitted:AdmittedTavernTemplateComponentV1|undefined
  let currentRuntime:TavernTemplateCurrentRuntimeV1|undefined
  function checkCurrentSync(checks:()=>void):void {
    if(closed)throw Error('TEMPLATE_RUNTIME_DISPOSED')
    ownedReadScopeDepth++
    try {
      // Only internal synchronous read/assert guards use this scope. It never
      // encloses code loading, persistence, worker or provider dispatch.
      if(currentRuntime){currentRuntime.checkCurrentSync(checks);return}
      const returned=checks() as unknown
      if(returned&&typeof returned==='object'&&'then' in returned) {
        throw Error('TEMPLATE_RUNTIME_ASYNC_VERIFICATION_SCOPE')
      }
      if(closed)throw Error('TEMPLATE_RUNTIME_DISPOSED')
    } finally {ownedReadScopeDepth--}
  }
  async function load():Promise<AdmittedTavernTemplateComponentV1> {
    const root=owningProductRoot(),require=createRequire(path.join(root,'package.json'))
    const metadataPath=fs.realpathSync(require.resolve(NAME+'/package.json'))
    const ownedDirectory=path.join(root,'node_modules',NAME),ownedStat=fs.lstatSync(ownedDirectory)
    if(!ownedStat.isDirectory()||ownedStat.isSymbolicLink())throw Error('TEMPLATE_RUNTIME_PACKAGE_OWNER_CHANGED')
    const owned=fs.realpathSync(ownedDirectory)
    if(owned!==path.resolve(ownedDirectory))throw Error('TEMPLATE_RUNTIME_PACKAGE_OWNER_CHANGED')
    if(metadataPath!==path.join(owned,'package.json'))throw Error('TEMPLATE_RUNTIME_PACKAGE_OWNER_CHANGED')
    const entry=fs.realpathSync(require.resolve(NAME))
    if(entry!==path.join(owned,'dist','index.mjs'))throw Error('TEMPLATE_RUNTIME_ENTRY_OWNER_CHANGED')
    const bootstrap=await import(pathToFileURL(path.join(root,'lib/operations/bundled-package-bootstrap.mjs')).href) as
      typeof import('../operations/bundled-package-bootstrap.mjs')
    const protection=await import(pathToFileURL(path.join(root,'lib/operations/protected-packages.mjs')).href) as
      typeof import('../operations/protected-packages.mjs')
    const readInventory=()=>{
      if(closed)throw Error('TEMPLATE_RUNTIME_DISPOSED')
      const identity=bootstrap.readBundleIdentity(root)
      const rows=identity.packages.filter(row=>row.name===NAME)
      if(identity.productRoot!==root||rows.length!==1||rows[0]!.version!==VERSION
        ||fs.realpathSync(require.resolve(NAME+'/package.json'))!==metadataPath
        ||fs.realpathSync(path.join(root,'node_modules',NAME))!==owned
        ||fs.realpathSync(require.resolve(NAME))!==entry)throw Error('TEMPLATE_RUNTIME_INVENTORY_OWNER_CHANGED')
      const row=rows[0]!
      if(protection.protectedGeneration(row)!==row.generation)throw Error('TEMPLATE_RUNTIME_GENERATION_CHANGED')
      return row
    }
    const readOwnedInventory=():TavernTemplateOwnedInventoryV1=>{
      const row=readInventory()
      return {name:NAME,version:VERSION,files:structuredClone(row.files),generation:row.generation}
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
      if(runtime.identity.packageName!==NAME||runtime.identity.packageVersion!==VERSION
        ||runtime.identity.protectedGeneration!==initialGeneration)throw Error('TEMPLATE_RUNTIME_IMPLEMENTATION_CHANGED')
      const result=Object.freeze({runtime,inventory:initial,
        verify:()=>{runtime.checkCurrent()},
        observe:()=>{runtime.checkCurrent()},checkCurrentSync})
      currentRuntime=runtime
      admitted=result
      return result
    } catch(error) {
      await runtime.dispose()
      throw error
    }
  }
  return {
    checkCurrentSync,
    /** Admission already captured the product/component generation. Later
     * availability checks consult only the actual runtime's lifetime. */
    observeAdmitted():AdmittedTavernTemplateComponentV1|undefined {
      if(closed||!admitted)return undefined
      admitted.observe()
      return admitted
    },
    current():AdmittedTavernTemplateComponentV1|undefined {
      if(closed||!admitted)return undefined
      admitted.verify()
      return admitted
    },
    async load(signal?:AbortSignal):Promise<AdmittedTavernTemplateComponentV1> {
      signal?.throwIfAborted()
      if(closed)throw Error('TEMPLATE_RUNTIME_DISPOSED')
      if(ownedReadScopeDepth)throw Error('TEMPLATE_EXECUTION_IN_VERIFICATION_SCOPE')
      currentRuntime?.assertCurrentScopeInactive()
      if(!pending){pending=load();void pending.catch(()=>{if(!closed)pending=undefined})}
      const result=await pending
      signal?.throwIfAborted()
      if(closed)throw Error('TEMPLATE_RUNTIME_DISPOSED')
      result.verify()
      return result
    },
    async dispose():Promise<void> {
      if(ownedReadScopeDepth)throw Error('TEMPLATE_EXECUTION_IN_VERIFICATION_SCOPE')
      currentRuntime?.assertCurrentScopeInactive()
      closed=true
      currentRuntime?.invalidateCurrent()
      // Await an in-flight factory: its own post-await guard disposes any late
      // runtime before rejecting; cancellation cannot leave a worker owner.
      const result=admitted??await pending?.catch(()=>undefined)
      await result?.runtime.dispose()
    },
  }
}
