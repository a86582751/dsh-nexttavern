/** One compiler owner is shared by the profile's protected runtime packages. */
import {createHash} from 'node:crypto'
import {readFileSync,realpathSync} from 'node:fs'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
import type * as TypeScript from 'typescript'
import {TYPESCRIPT_RUNTIME_NAME,TYPESCRIPT_RUNTIME_VERSION,TYPESCRIPT_VERSION,TYPESCRIPT_ENTRY_SHA256}
  from '../../../src/core/tavern-typescript-runtime-descriptor.mjs'
export {TYPESCRIPT_RUNTIME_NAME,TYPESCRIPT_RUNTIME_VERSION,TYPESCRIPT_VERSION,TYPESCRIPT_ENTRY_SHA256,
  TYPESCRIPT_SHARED_DEPENDENCY} from '../../../src/core/tavern-typescript-runtime-descriptor.mjs'

const sha=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex')
const require=createRequire(import.meta.url)
const compilerEntry=realpathSync(require.resolve('typescript'))
const ownedEntry=realpathSync(fileURLToPath(new URL('../node_modules/typescript/lib/typescript.js',import.meta.url)))
if(compilerEntry!==ownedEntry||sha(readFileSync(compilerEntry))!==TYPESCRIPT_ENTRY_SHA256)
  throw Error('TYPESCRIPT_RUNTIME_BYTES_CHANGED')
// Checking before require keeps changed compiler bytes out of every new Worker.
const ts=require(compilerEntry) as typeof TypeScript
if(ts.version!==TYPESCRIPT_VERSION)throw Error('TYPESCRIPT_RUNTIME_BYTES_CHANGED')
export {ts as default}

export interface TypeScriptPackageInventory {
  readonly name:string
  readonly version:string
  readonly generation:string
  readonly files:readonly {readonly path:string;readonly sha256:string}[]
}
export interface AdmittedTypeScript {
  readonly ownerName:typeof TYPESCRIPT_RUNTIME_NAME
  readonly ownerVersion:typeof TYPESCRIPT_RUNTIME_VERSION
  readonly generation:string
  readonly compilerFingerprint:string
  readonly entry:URL
  checkCurrent():void
}

let loadedGeneration:string|undefined
/** Core has already admitted these exact files. No consumer rehashes the
 * shared directory; each fresh Worker checks the compiler it actually loads. */
export function createAdmittedTypeScript(inventory:TypeScriptPackageInventory,
  checkOwnerCurrent:()=>void):AdmittedTypeScript {
  checkOwnerCurrent()
  if(inventory.name!==TYPESCRIPT_RUNTIME_NAME||inventory.version!==TYPESCRIPT_RUNTIME_VERSION)
    throw Error('TYPESCRIPT_RUNTIME_OWNER_CHANGED')
  if(loadedGeneration!==undefined&&loadedGeneration!==inventory.generation)
    throw Error('TYPESCRIPT_RUNTIME_RESTART_REQUIRED')
  loadedGeneration??=inventory.generation
  const files=inventory.files.filter(row=>row.path.startsWith('node_modules/typescript/'))
    .map(({path,sha256})=>({path,sha256})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)
  const compilerFingerprint=sha(JSON.stringify({encoding:'owned-typescript-published-files-v1',files}))
  const generation=inventory.generation
  return Object.freeze({ownerName:TYPESCRIPT_RUNTIME_NAME,ownerVersion:TYPESCRIPT_RUNTIME_VERSION,
    generation,compilerFingerprint,entry:pathToFileURL(compilerEntry),checkCurrent() {
      checkOwnerCurrent()
      if(loadedGeneration!==generation)throw Error('TYPESCRIPT_RUNTIME_RESTART_REQUIRED')
    }})
}
