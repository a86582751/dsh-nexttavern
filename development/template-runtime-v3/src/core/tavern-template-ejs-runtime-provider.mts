import {recordSha256} from './roleplay-data.js'
import {createOwnedEjsRuntimeController} from './tavern-template-ejs-runtime-controller.mjs'
import {EJS_RUNTIME_PACKAGE,EJS_RUNTIME_VERSION,EJS_RUNTIME_POLICY} from './tavern-template-ejs-runtime-types.mjs'
import type {TavernEjsRuntime,TavernEjsRuntimeInventory,TavernEjsRuntimeIdentity}
  from './tavern-template-ejs-runtime-types.mjs'

const root=new URL('../',import.meta.url)
let generation:string|undefined,verificationDepth=0
export async function createOwnedTavernEjsRuntimeV1(deps:{
  /** The product owner admits the complete component before importing this
   * factory. Publication capture supplies its verified immutable extraction. */
  verifyOwnedPackage(root:URL):TavernEjsRuntimeInventory}):Promise<TavernEjsRuntime> {
  if(verificationDepth)throw Error('TEMPLATE_EXECUTION_IN_VERIFICATION_SCOPE')
  const inventory=deps.verifyOwnedPackage(new URL(root))
  if(inventory.name!==EJS_RUNTIME_PACKAGE||inventory.version!==EJS_RUNTIME_VERSION)
    throw Error('TEMPLATE_EJS_COMPONENT_IDENTITY')
  if(generation!==undefined&&generation!==inventory.generation)throw Error('TEMPLATE_GENERATION_RESTART_REQUIRED')
  const implementation=inventory.files.filter(file=>file.path==='dist/index.mjs'
    ||file.path==='dist/tavern-template-ejs-runtime-worker.mjs')
    .sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)
  if(implementation.length!==2)throw Error('TEMPLATE_EJS_COMPONENT_MODULES')
  generation??=inventory.generation
  const identity:TavernEjsRuntimeIdentity=Object.freeze({schemaVersion:1,encoding:'owned-ejs-template-engine-v1',
    factory:'template-ejs-v1',packageName:inventory.name,version:inventory.version,protectedGeneration:inventory.generation,
    policySha256:recordSha256(EJS_RUNTIME_POLICY),implementationSha256:recordSha256(implementation)})
  let disposed=false
  const current=()=>{if(disposed)throw Error('TEMPLATE_RUNTIME_DISPOSED');return inventory}
  const allowed=()=>{if(verificationDepth)throw Error('TEMPLATE_EXECUTION_IN_VERIFICATION_SCOPE')}
  const runtime=createOwnedEjsRuntimeController({identity,current,assertExecutionAllowed:allowed})
  return {...runtime,checkCurrentSync(callback){
    current();verificationDepth++
    try {const result=callback() as unknown
      if(result&&typeof result==='object'&&'then' in result)throw Error('TEMPLATE_RUNTIME_ASYNC_VERIFICATION_SCOPE')
      current()
    }finally {verificationDepth--}
  },async dispose(){disposed=true;await runtime.dispose()}}
}
