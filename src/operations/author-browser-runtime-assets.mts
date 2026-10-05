/** Browser component producer. The source manifest is the only mapping owner;
 * the existing locked assembler owns complete published dependency copying.
 * This builder does not execute author code, a worker, provider or DOM realm. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {materializeBundledLibraries} from './bundled-library-assembly.mjs'
import {AUTHOR_BROWSER_RUNTIME_NAME,AUTHOR_BROWSER_RUNTIME_VERSION,AUTHOR_BROWSER_RUNTIME_PINS,
  AUTHOR_BROWSER_MODULES,AUTHOR_BROWSER_RUNTIME_DESCRIPTOR,AUTHOR_BROWSER_SOURCE_INPUTS,
  authorBrowserAssetSha} from '../core/tavern-author-browser-descriptor.mjs'
import type {AuthorBrowserRuntimeRoleV1,AuthorBrowserRuntimeDescriptorV1}
  from '../core/tavern-author-browser-descriptor.mjs'

interface Artifact {id:string;source:string}
interface Resource {artifact:string;path:string}
export interface AuthorBrowserRuntimeAssetRecipeV1 {
  schemaVersion:1
  encoding:'owned-author-browser-runtime-recipe-v1'
  packageArtifact:string
  modules:readonly {role:AuthorBrowserRuntimeRoleV1;artifact:string;output:string}[]
  descriptorOutput:'assets/runtime.json'
  sourceInputOutput:'assets/source-inputs.json'
  policyArtifact:string
  lockArtifact:string
  dependencies:Record<string,string>
  builder:{esbuildVersion:'0.24.2';target:'es2023';bundle:true;write:false;legalComments:'none'}
  sourceGraph:'esbuild-metafile-input-sha256'
  dependencyClosure:'locked-published-typescript-lib'
}
export interface AuthorBrowserRuntimeAssetPlanV1 {
  artifacts:readonly Artifact[]
  product:{authorBrowserRuntime?:AuthorBrowserRuntimeAssetRecipeV1;
    packages:readonly {packageArtifact:string;resources?:readonly Resource[]}[]}
}
interface SourceInput {artifact:string;path:string;sha256:string}
const artifact=(plan:AuthorBrowserRuntimeAssetPlanV1,id:string)=>{
  const row=plan.artifacts.find(item=>item.id===id)
  if(!row)throw Error('AUTHOR_BROWSER_ASSET_ARTIFACT_UNKNOWN: '+id)
  return row
}
const pinsEqual=(pins:Record<string,string>)=>JSON.stringify(Object.entries(pins).sort())
  ===JSON.stringify(Object.entries(AUTHOR_BROWSER_RUNTIME_PINS).sort())
const safe=(value:string)=>!!value&&!value.includes('\\')&&!value.includes(':')&&!value.startsWith('/')
  &&value.split('/').every(part=>!!part&&part!=='.'&&part!=='..')
function inside(root:string,relative:string):string {
  if(!safe(relative))throw Error('AUTHOR_BROWSER_ASSET_PATH_INVALID')
  return path.join(root,...relative.split('/'))
}
/** Component role/entry association is checked once here. Global manifest
 * uniqueness, delivery policy and root ownership stay with the plan owner. */
export function authorBrowserRuntimeRecipeV1(plan:AuthorBrowserRuntimeAssetPlanV1):AuthorBrowserRuntimeAssetRecipeV1|undefined {
  const recipe=plan.product.authorBrowserRuntime
  if(!recipe)return undefined
  const roles=Object.keys(AUTHOR_BROWSER_MODULES)
  if(recipe.schemaVersion!==1||recipe.encoding!=='owned-author-browser-runtime-recipe-v1'
    ||recipe.descriptorOutput!==AUTHOR_BROWSER_RUNTIME_DESCRIPTOR||recipe.sourceInputOutput!==AUTHOR_BROWSER_SOURCE_INPUTS
    ||!pinsEqual(recipe.dependencies)||recipe.modules.length!==roles.length
    ||new Set(recipe.modules.map(row=>row.role)).size!==roles.length
    ||recipe.modules.some(row=>!Object.hasOwn(AUTHOR_BROWSER_MODULES,row.role)||row.output!==AUTHOR_BROWSER_MODULES[row.role])
    ||recipe.builder.esbuildVersion!=='0.24.2'||recipe.builder.target!=='es2023'
    ||recipe.builder.bundle!==true||recipe.builder.write!==false||recipe.builder.legalComments!=='none'
    ||recipe.sourceGraph!=='esbuild-metafile-input-sha256'||recipe.dependencyClosure!=='locked-published-typescript-lib') {
    throw Error('AUTHOR_BROWSER_ASSET_RECIPE_INVALID')
  }
  return recipe
}
function packageResources(plan:AuthorBrowserRuntimeAssetPlanV1,recipe:AuthorBrowserRuntimeAssetRecipeV1):readonly Resource[] {
  const row=plan.product.packages.find(item=>item.packageArtifact===recipe.packageArtifact)
  if(!row)throw Error('AUTHOR_BROWSER_ASSET_PACKAGE_UNREGISTERED')
  return row.resources??[]
}
/** Emit five genuine modules. Platform/format are fixed by each role: provider,
 * partition and AST worker are Node ESM; child and guard are browser IIFE. */
export async function buildAuthorBrowserRuntimeAssetsV1(options:{repo:string;plan:AuthorBrowserRuntimeAssetPlanV1;
  packageRoot:string;write?:boolean}) {
  const repo=fs.realpathSync(options.repo),recipe=authorBrowserRuntimeRecipeV1(options.plan)
  if(!recipe)throw Error('AUTHOR_BROWSER_ASSET_RECIPE_MISSING')
  const lockFile=inside(repo,artifact(options.plan,recipe.lockArtifact).source)
  const require=createRequire(path.join(path.dirname(lockFile),'package.json'))
  const esbuild=require('esbuild') as typeof import('esbuild')
  const lock=JSON.parse(fs.readFileSync(lockFile,'utf8')) as {packages:Record<string,{version?:string}>}
  if(esbuild.version!==recipe.builder.esbuildVersion||lock.packages['node_modules/esbuild']?.version!==esbuild.version) {
    throw Error('AUTHOR_BROWSER_ASSET_BUILDER_PIN_INVALID')
  }
  const resources=packageResources(options.plan,recipe)
  const registered=new Map(options.plan.artifacts.map(item=>[path.resolve(inside(repo,item.source)),item]))
  const graphs:Partial<Record<AuthorBrowserRuntimeRoleV1,readonly SourceInput[]>>={}
  const outputs=new Map<string,Buffer>()
  const prefix=path.posix.dirname(artifact(options.plan,recipe.packageArtifact).source)
  for(const output of [...Object.values(AUTHOR_BROWSER_MODULES),recipe.descriptorOutput,recipe.sourceInputOutput]) {
    if(!options.plan.artifacts.some(item=>item.source===prefix+'/'+output))throw Error('AUTHOR_BROWSER_ASSET_OUTPUT_UNREGISTERED: '+output)
  }
  for(const module of recipe.modules) {
    const entry=inside(repo,artifact(options.plan,module.artifact).source)
    const browser=module.role==='child'||module.role==='guard'
    const result=await esbuild.build({absWorkingDir:repo,entryPoints:[entry],bundle:true,
      platform:browser?'browser':'node',format:browser?'iife':'esm',target:recipe.builder.target,
      write:false,metafile:true,minifyWhitespace:true,tsconfigRaw:{compilerOptions:{}},
      external:browser?[]:Object.keys(recipe.dependencies),legalComments:'none'})
    const output=result.outputFiles?.[0]
    if(!output||result.outputFiles?.length!==1||!result.metafile)throw Error('AUTHOR_BROWSER_ASSET_OUTPUT_INVALID')
    graphs[module.role]=Object.keys(result.metafile.inputs).map(input=>{
      const file=fs.realpathSync(path.resolve(repo,input)),registeredSource=registered.get(file)
      if(!registeredSource||!file.startsWith(repo+path.sep)||!/\.(?:ts|mts)$/.test(file)) {
        throw Error('AUTHOR_BROWSER_ASSET_SOURCE_UNREGISTERED: '+input)
      }
      const resource=resources.find(row=>row.artifact===registeredSource.id)
      if(!resource||!resource.path.startsWith('src/')||!safe(resource.path)) {
        throw Error('AUTHOR_BROWSER_ASSET_SOURCE_RESOURCE_UNREGISTERED: '+registeredSource.id)
      }
      return {artifact:registeredSource.id,path:resource.path,sha256:authorBrowserAssetSha(fs.readFileSync(file))}
    }).sort((left,right)=>left.path<right.path?-1:left.path>right.path?1:0)
    outputs.set(module.output,Buffer.from(output.contents))
  }
  // Import only trusted emitted profile data. A distinct build query avoids
  // claiming new Source while a long-lived builder retains an older module.
  const policyFile=inside(repo,artifact(options.plan,recipe.policyArtifact).source),policyURL=pathToFileURL(policyFile)
  policyURL.searchParams.set('authorBrowserBuild',authorBrowserAssetSha(JSON.stringify(graphs)+authorBrowserAssetSha(fs.readFileSync(policyFile))))
  const policy=await import(policyURL.href) as {BROWSER_PROFILE_V1:{sha256:string};BROWSER_CAPABILITY_CONTRACT_V1:{contractSha256:string}}
  const descriptor:AuthorBrowserRuntimeDescriptorV1={schemaVersion:1,name:AUTHOR_BROWSER_RUNTIME_NAME,
    version:AUTHOR_BROWSER_RUNTIME_VERSION,modules:AUTHOR_BROWSER_MODULES,dependencies:AUTHOR_BROWSER_RUNTIME_PINS,
    profileSha256:policy.BROWSER_PROFILE_V1.sha256,capabilityContractSha256:policy.BROWSER_CAPABILITY_CONTRACT_V1.contractSha256}
  outputs.set(recipe.descriptorOutput,Buffer.from(JSON.stringify(descriptor,null,2)+'\n'))
  outputs.set(recipe.sourceInputOutput,Buffer.from(JSON.stringify({schemaVersion:1,
    encoding:'owned-author-browser-runtime-source-inputs-v1',name:AUTHOR_BROWSER_RUNTIME_NAME,
    version:AUTHOR_BROWSER_RUNTIME_VERSION,graphs},null,2)+'\n'))
  const root=path.resolve(options.packageRoot)
  for(const [output,bytes] of outputs) {
    const file=inside(root,output)
    if(options.write){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes)}
    else if(!fs.existsSync(file)||!fs.readFileSync(file).equals(bytes))throw Error('AUTHOR_BROWSER_ASSET_GENERATED_STALE: '+output)
  }
  return {name:AUTHOR_BROWSER_RUNTIME_NAME,version:AUTHOR_BROWSER_RUNTIME_VERSION,graphs,
    files:[...outputs].map(([output,bytes])=>({path:output,sha256:authorBrowserAssetSha(bytes)}))}
}
/** Complete published TS files are required, not a private declaration list.
 * The assembler alone checks the exact lock graph, copies and license files. */
export function materializeAuthorBrowserRuntimeDependenciesV1(options:{repo:string;plan:AuthorBrowserRuntimeAssetPlanV1;
  packageRoot:string;libraryRoot:string;admit:(file:string,bytes:Buffer)=>boolean}) {
  const repo=fs.realpathSync(options.repo),recipe=authorBrowserRuntimeRecipeV1(options.plan)
  if(!recipe)throw Error('AUTHOR_BROWSER_ASSET_RECIPE_MISSING')
  return materializeBundledLibraries({libraryRoot:options.libraryRoot,
    moduleRoot:inside(path.resolve(options.packageRoot),'node_modules'),
    lockFile:inside(repo,artifact(options.plan,recipe.lockArtifact).source),libraries:recipe.dependencies,
    admit:(file,bytes)=>{
      if(!options.admit(file,bytes))throw Error('AUTHOR_BROWSER_TYPESCRIPT_PUBLISHED_FILE_REJECTED: '+file)
      return true
    }})
}
