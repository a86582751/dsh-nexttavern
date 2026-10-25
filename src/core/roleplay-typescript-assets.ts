/** One lazy admission owns the shared compiler for the Core lifecycle. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {TYPESCRIPT_RUNTIME_NAME,TYPESCRIPT_RUNTIME_VERSION} from './tavern-typescript-runtime-descriptor.mjs'
import type {AdmittedTypeScript} from 'dsh-nexttavern-typescript-runtime'
import type {ReleasedComponentRef} from '../operations/released-component-types.mjs'

export function createRoleplayTypeScriptAssetOwner() {
  let closed=false
  const runtimes=new Map<string,Promise<AdmittedTypeScript>>()
  const current=()=>{if(closed)throw Error('TYPESCRIPT_RUNTIME_DISPOSED')}
  type ProductAssets={root:string;require:ReturnType<typeof createRequire>;
    identity:ReturnType<typeof import('../operations/bundled-package-bootstrap.mjs').readBundleIdentity>;
    protection:typeof import('../operations/protected-packages.mjs')}
  let product:Promise<ProductAssets>|undefined
  async function loadProduct():Promise<ProductAssets> {
    let root:string|undefined
    for(const relative of ['../../','../../../']) {
      const candidate=fs.realpathSync(fileURLToPath(new URL(relative,import.meta.url)))
      const metadata=path.join(candidate,'package.json')
      if(!fs.existsSync(metadata))continue
      const value=JSON.parse(fs.readFileSync(metadata,'utf8'))
      if(value.name==='dsh-nexttavern'&&value.dependencies?.[TYPESCRIPT_RUNTIME_NAME]===TYPESCRIPT_RUNTIME_VERSION) {
        root=candidate;break
      }
    }
    if(!root)throw Error('TYPESCRIPT_RUNTIME_PRODUCT_OWNER_UNAVAILABLE')
    const bootstrap=await import(pathToFileURL(path.join(root,'lib/operations/bundled-package-bootstrap.mjs')).href) as
      typeof import('../operations/bundled-package-bootstrap.mjs')
    const protection=await import(pathToFileURL(path.join(root,'lib/operations/protected-packages.mjs')).href) as
      typeof import('../operations/protected-packages.mjs')
    current()
    const identity=bootstrap.readBundleIdentity(root)
    return {root,require:createRequire(path.join(root,'package.json')),identity,protection}
  }
  const productAssets=()=>product??=loadProduct().catch(error=>{product=undefined;throw error})
  async function load(ref?:ReleasedComponentRef):Promise<AdmittedTypeScript> {
    const {root,require,identity,protection}=await productAssets()
    current()
    const selected=ref??identity.currentRuntime?.roles.typescript
    const binding=selected?identity.runtimeComponents.get(selected.name+'\0'+selected.generation+'\0'+(selected.context??'')):undefined
    const specs=selected?binding?[binding]:[]:identity.packages.filter(spec=>spec.name===TYPESCRIPT_RUNTIME_NAME)
    if(identity.productRoot!==root||specs.length!==1||(binding?binding.factory!=='typescript-v1':selected!==undefined)
      ||!binding&&specs[0]!.version!==TYPESCRIPT_RUNTIME_VERSION)
      throw Error('TYPESCRIPT_RUNTIME_INVENTORY_OWNER_CHANGED')
    const spec=specs[0]!,owned=fs.realpathSync(binding?.source??path.join(root,'node_modules',TYPESCRIPT_RUNTIME_NAME))
    const historical=binding?.path!==undefined
    if(!historical&&fs.realpathSync(require.resolve(TYPESCRIPT_RUNTIME_NAME+'/package.json'))!==path.join(owned,'package.json'))
      throw Error('TYPESCRIPT_RUNTIME_PACKAGE_OWNER_CHANGED')
    const entry=fs.realpathSync(historical?path.join(owned,'lib/index.js'):require.resolve(TYPESCRIPT_RUNTIME_NAME)),
      relative=path.relative(owned,entry)
    if(path.isAbsolute(relative)||relative==='..'||relative.startsWith('..'+path.sep))
      throw Error('TYPESCRIPT_RUNTIME_ENTRY_OWNER_CHANGED')
    protection.verifyProtectedPackage(owned,spec)
    current()
    const factory=await import(pathToFileURL(entry).href) as typeof import('dsh-nexttavern-typescript-runtime')
    current()
    return factory.createAdmittedTypeScript({name:spec.name,version:spec.version,generation:spec.generation,
      files:structuredClone(spec.files)},current)
  }
  return {
    async get(ref?:ReleasedComponentRef):Promise<AdmittedTypeScript> {
      current()
      const {identity}=await productAssets()
      const selected=ref??identity.currentRuntime?.roles.typescript
      const key=selected?selected.name+'\0'+selected.generation+'\0'+(selected.context??''):'default'
      let pending=runtimes.get(key)
      if(!pending) {
        pending=load(selected).catch(error=>{runtimes.delete(key);throw error})
        runtimes.set(key,pending)
      }
      const actual=await pending
      current();actual.checkCurrent();return actual
    },
    dispose(){closed=true},
  }
}
