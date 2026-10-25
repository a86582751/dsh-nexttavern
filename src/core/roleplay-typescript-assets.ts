/** One lazy admission owns the shared compiler for the Core lifecycle. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {TYPESCRIPT_RUNTIME_NAME,TYPESCRIPT_RUNTIME_VERSION} from './tavern-typescript-runtime-descriptor.mjs'
import type {AdmittedTypeScript} from 'dsh-nexttavern-typescript-runtime'

export function createRoleplayTypeScriptAssetOwner() {
  let closed=false,pending:Promise<AdmittedTypeScript>|undefined
  const current=()=>{if(closed)throw Error('TYPESCRIPT_RUNTIME_DISPOSED')}
  async function load():Promise<AdmittedTypeScript> {
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
    const specs=identity.packages.filter(spec=>spec.name===TYPESCRIPT_RUNTIME_NAME)
    if(identity.productRoot!==root||specs.length!==1||specs[0]!.version!==TYPESCRIPT_RUNTIME_VERSION)
      throw Error('TYPESCRIPT_RUNTIME_INVENTORY_OWNER_CHANGED')
    const spec=specs[0]!,owned=fs.realpathSync(path.join(root,'node_modules',TYPESCRIPT_RUNTIME_NAME))
    const require=createRequire(path.join(root,'package.json'))
    if(fs.realpathSync(require.resolve(TYPESCRIPT_RUNTIME_NAME+'/package.json'))!==path.join(owned,'package.json'))
      throw Error('TYPESCRIPT_RUNTIME_PACKAGE_OWNER_CHANGED')
    const entry=fs.realpathSync(require.resolve(TYPESCRIPT_RUNTIME_NAME)),relative=path.relative(owned,entry)
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
    async get():Promise<AdmittedTypeScript> {
      current()
      pending??=load().catch(error=>{pending=undefined;throw error})
      const actual=await pending
      current();actual.checkCurrent();return actual
    },
    dispose(){closed=true},
  }
}
