/** Independent template component producer. The shared manifest owns all
 * mappings; the existing locked library assembler owns dependency copying.
 * This module never installs packages or executes a template/VM/provider. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
import {materializeBundledLibraries} from './bundled-library-assembly.mjs'
import {regularPackageFiles} from './owned-dependency.mjs'

const PACKAGE_NAME='dsh-nexttavern-template-runtime-v1'
const PACKAGE_VERSION='0.1.0'
const PINS=Object.freeze({'quickjs-emscripten-core':'0.32.0',
  '@jitl/quickjs-wasmfile-release-sync':'0.32.0','@jitl/quickjs-ffi-types':'0.32.0'})
const MODULES=Object.freeze({provider:'dist/index.mjs',controller:'dist/controller.mjs',
  worker:'dist/tavern-template-worker.mjs'})
type Role=keyof typeof MODULES
interface Artifact {id:string;source:string}
interface Resource {artifact:string;path:string}
export interface TavernTemplateRuntimeAssetRecipeV1 {
  schemaVersion:1
  encoding:'owned-template-component-recipe-proposal-v1'
  packageArtifact:string
  modules:readonly {role:Role;artifact:string;output:string}[]
  descriptorOutput:'assets/runtime.json'
  sourceInputOutput:'assets/source-inputs.json'
  policyArtifact:string
  lockArtifact:string
  dependencies:Record<string,string>
  guests:readonly []
  builder:{esbuildVersion:'0.24.2';target:'es2023';format:'esm';platform:'node';bundle:true;
    external:readonly string[];write:false;legalComments:'none'}
  sourceGraph:string
  dependencyClosure:string
}
export interface TavernTemplateRuntimeAssetPlanV1 {
  artifacts:readonly Artifact[]
  product:{templateRuntime?:TavernTemplateRuntimeAssetRecipeV1;
    packages:readonly {packageArtifact:string;resources?:readonly Resource[];immutableGeneration?:string}[]}
}
interface Metadata {
  name:string;version:string;type?:string;license?:string;main?:string;exports?:unknown;
  files?:string[];dependencies?:Record<string,string>;bundleDependencies?:string[];
  optionalDependencies?:Record<string,string>;peerDependencies?:Record<string,string>
}
interface PackageLock {lockfileVersion?:number;packages?:Record<string,{version?:string;link?:boolean;
  resolved?:string;integrity?:string;dependencies?:Record<string,string>;optionalDependencies?:Record<string,string>}>}
const digest=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex')
const safe=(value:string)=>typeof value==='string'&&!!value&&!value.includes('\\')&&!value.includes(':')
  &&!value.startsWith('/')&&value.split('/').every(part=>!!part&&part!=='.'&&part!=='..')
function inside(root:string,relative:string):string {
  if(!safe(relative))throw Error('TEMPLATE_ASSET_PATH_INVALID')
  return path.join(root,...relative.split('/'))
}
const json=<T,>(file:string):T=>JSON.parse(fs.readFileSync(file,'utf8')) as T
const samePins=(value:Record<string,string>|undefined)=>JSON.stringify(Object.entries(value??{}).sort())
  ===JSON.stringify(Object.entries(PINS).sort())
function uniqueArtifact(plan:TavernTemplateRuntimeAssetPlanV1,id:string):Artifact {
  const rows=plan.artifacts.filter(row=>row.id===id)
  if(rows.length!==1||!safe(rows[0]!.source))throw Error('TEMPLATE_ASSET_ARTIFACT_UNKNOWN')
  return rows[0]!
}
/** Exact component tuple, without widening any schema executor recipe. */
export function templateRuntimeRecipeV1(plan:TavernTemplateRuntimeAssetPlanV1):TavernTemplateRuntimeAssetRecipeV1|undefined {
  const recipe=plan.product.templateRuntime
  if(!recipe)return undefined
  if(recipe.schemaVersion!==1||recipe.encoding!=='owned-template-component-recipe-proposal-v1'
    ||recipe.descriptorOutput!=='assets/runtime.json'||recipe.sourceInputOutput!=='assets/source-inputs.json'
    ||!samePins(recipe.dependencies)||recipe.guests.length!==0||recipe.modules.length!==3
    ||new Set(recipe.modules.map(row=>row.role)).size!==3
    ||recipe.modules.some(row=>!Object.hasOwn(MODULES,row.role)||row.output!==MODULES[row.role])
    ||recipe.builder.esbuildVersion!=='0.24.2'||recipe.builder.target!=='es2023'
    ||recipe.builder.format!=='esm'||recipe.builder.platform!=='node'||recipe.builder.bundle!==true
    ||recipe.builder.write!==false||recipe.builder.legalComments!=='none'
    ||JSON.stringify([...recipe.builder.external].sort())!==JSON.stringify(Object.keys(PINS).sort())) {
    throw Error('TEMPLATE_ASSET_RECIPE_INVALID')
  }
  uniqueArtifact(plan,recipe.packageArtifact)
  uniqueArtifact(plan,recipe.policyArtifact)
  uniqueArtifact(plan,recipe.lockArtifact)
  for(const row of recipe.modules)uniqueArtifact(plan,row.artifact)
  if(plan.product.packages.filter(row=>row.packageArtifact===recipe.packageArtifact).length!==1) {
    throw Error('TEMPLATE_ASSET_PACKAGE_RECIPE_INVALID')
  }
  return recipe
}
function metadataAt(repo:string,plan:TavernTemplateRuntimeAssetPlanV1,recipe:TavernTemplateRuntimeAssetRecipeV1):Metadata {
  const metadata=json<Metadata>(inside(repo,uniqueArtifact(plan,recipe.packageArtifact).source))
  if(metadata.name!==PACKAGE_NAME||metadata.version!==PACKAGE_VERSION||metadata.type!=='module'
    ||metadata.license!=='GPL-3.0-only'||metadata.main!=='./dist/index.mjs'||!samePins(metadata.dependencies)
    ||JSON.stringify(metadata.exports)!==JSON.stringify({'.':'./dist/index.mjs','./package.json':'./package.json'})
    ||JSON.stringify([...(metadata.bundleDependencies??[])].sort())!==JSON.stringify(Object.keys(PINS).sort())
    ||Object.keys(metadata.optionalDependencies??{}).length||Object.keys(metadata.peerDependencies??{}).length) {
    throw Error('TEMPLATE_ASSET_PACKAGE_METADATA_INVALID')
  }
  return metadata
}
function libraryPins(repo:string,plan:TavernTemplateRuntimeAssetPlanV1,
  recipe:TavernTemplateRuntimeAssetRecipeV1,libraryRoot:string) {
  // Keep the registered logical lock beside compiler metadata even if libraryRoot is a junction.
  const lockPath=inside(repo,uniqueArtifact(plan,recipe.lockArtifact).source)
  const lock=json<PackageLock>(lockPath)
  if(lock.lockfileVersion!==3||!lock.packages)throw Error('TEMPLATE_ASSET_LOCK_INVALID')
  for(const [name,version] of Object.entries(PINS)) {
    const metadata=json<Metadata>(inside(libraryRoot,name+'/package.json'))
    const row=lock.packages['node_modules/'+name]
    if(metadata.name!==name||metadata.version!==version||metadata.license!=='MIT'
      ||row?.version!==version||row.link||!row.resolved||!row.integrity
      ||Object.keys(metadata.optionalDependencies??{}).length||Object.keys(metadata.peerDependencies??{}).length) {
      throw Error('TEMPLATE_ASSET_DEPENDENCY_PIN_INVALID')
    }
    const expected=name==='@jitl/quickjs-ffi-types'?{}:{'@jitl/quickjs-ffi-types':'0.32.0'}
    if(JSON.stringify(metadata.dependencies??{})!==JSON.stringify(expected)
      ||JSON.stringify(row.dependencies??{})!==JSON.stringify(expected))throw Error('TEMPLATE_ASSET_DEPENDENCY_GRAPH_INVALID')
    const license=fs.readFileSync(inside(libraryRoot,name+'/LICENSE'),'utf8')
    if(!license.includes('Permission is hereby granted'))throw Error('TEMPLATE_ASSET_DEPENDENCY_LICENSE_INVALID')
  }
  return {lockPath,lock}
}
/** Three genuine ESM bundles plus policy/source descriptors. Every esbuild
 * input must be registered and copied by the existing product resource recipe. */
export async function buildTavernTemplateRuntimeAssetsV1(options:{repo:string;plan:TavernTemplateRuntimeAssetPlanV1;
  packageRoot:string;libraryRoot:string;write?:boolean}) {
  const repo=fs.realpathSync(options.repo),recipe=templateRuntimeRecipeV1(options.plan)
  if(!recipe)throw Error('TEMPLATE_ASSET_RECIPE_MISSING')
  metadataAt(repo,options.plan,recipe)
  const libraryRoot=fs.realpathSync(options.libraryRoot)
  const {lockPath,lock}=libraryPins(repo,options.plan,recipe,libraryRoot)
  const require=createRequire(path.join(path.dirname(lockPath),'package.json'))
  const esbuild=require('esbuild') as typeof import('esbuild')
  if(esbuild.version!=='0.24.2'||lock.packages?.['node_modules/esbuild']?.version!=='0.24.2') {
    throw Error('TEMPLATE_ASSET_BUILDER_PIN_INVALID')
  }
  const row=options.plan.product.packages.find(item=>item.packageArtifact===recipe.packageArtifact)!
  const resources=row.resources??[]
  // Generated outputs are registered before their first build and may not yet
  // exist. Registration is lexical; actual inputs must resolve to those paths.
  const registered=new Set(options.plan.artifacts.map(item=>path.resolve(inside(repo,item.source))))
  const resourceFor=(file:string)=>{
    const rows=resources.filter(resource=>fs.realpathSync(inside(repo,
      uniqueArtifact(options.plan,resource.artifact).source))===file)
    if(rows.length!==1||!rows[0]!.path.startsWith('src/')||!safe(rows[0]!.path)) {
      throw Error('TEMPLATE_ASSET_SOURCE_RESOURCE_UNREGISTERED')
    }
    return rows[0]!
  }
  const prefix=path.posix.dirname(uniqueArtifact(options.plan,recipe.packageArtifact).source)
  const outputNames=[...Object.values(MODULES),recipe.descriptorOutput,recipe.sourceInputOutput]
  for(const output of outputNames)if(options.plan.artifacts.filter(item=>item.source===prefix+'/'+output).length!==1) {
    throw Error('TEMPLATE_ASSET_OUTPUT_UNREGISTERED')
  }
  const outputs=new Map<string,Buffer>()
  const graphs:Partial<Record<Role,readonly {artifact:string;path:string;sha256:string}[]>>={}
  for(const module of recipe.modules) {
    const entry=inside(repo,uniqueArtifact(options.plan,module.artifact).source)
    if(!/\.(?:ts|mts)$/.test(entry))throw Error('TEMPLATE_ASSET_ENTRY_INVALID')
    const result=await esbuild.build({absWorkingDir:repo,entryPoints:[entry],bundle:true,platform:'node',format:'esm',
      target:'es2023',write:false,metafile:true,minifyWhitespace:true,tsconfigRaw:{compilerOptions:{}},
      external:Object.keys(PINS),legalComments:'none'})
    if(result.outputFiles?.length!==1||!result.metafile)throw Error('TEMPLATE_ASSET_BUNDLE_OUTPUT_INVALID')
    graphs[module.role]=Object.keys(result.metafile.inputs).map(input=>{
      const file=fs.realpathSync(path.resolve(repo,input))
      if(!registered.has(file)||!file.startsWith(repo+path.sep)||!/\.(?:ts|mts)$/.test(file)) {
        throw Error('TEMPLATE_ASSET_SOURCE_UNREGISTERED')
      }
      const resource=resourceFor(file)
      return {artifact:resource.artifact,path:resource.path,sha256:digest(fs.readFileSync(file))}
    }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)
    outputs.set(module.output,Buffer.from(result.outputFiles[0]!.contents))
  }
  const policyFile=inside(repo,uniqueArtifact(options.plan,recipe.policyArtifact).source)
  const policyURL=pathToFileURL(policyFile)
  // A long-lived builder must not use an older policy module at the same URL.
  // This executes trusted emitted data, never the provider or a guest worker.
  policyURL.searchParams.set('templateBuild',digest(JSON.stringify(graphs)+digest(fs.readFileSync(policyFile))))
  const policyModule=await import(policyURL.href) as {
    readonly TEMPLATE_POLICY_SHA256:unknown
  }
  if(typeof policyModule.TEMPLATE_POLICY_SHA256!=='string'||!/^[a-f0-9]{64}$/.test(policyModule.TEMPLATE_POLICY_SHA256)) {
    throw Error('TEMPLATE_ASSET_POLICY_INVALID')
  }
  const descriptor={schemaVersion:1,name:PACKAGE_NAME,version:PACKAGE_VERSION,modules:MODULES,
    dependencies:PINS,policySha256:policyModule.TEMPLATE_POLICY_SHA256}
  outputs.set(recipe.descriptorOutput,Buffer.from(JSON.stringify(descriptor,null,2)+'\n'))
  outputs.set(recipe.sourceInputOutput,Buffer.from(JSON.stringify({schemaVersion:1,
    encoding:'owned-template-component-source-inputs-v1',name:PACKAGE_NAME,version:PACKAGE_VERSION,graphs},null,2)+'\n'))
  const root=path.resolve(options.packageRoot)
  for(const [output,bytes] of outputs) {
    const file=inside(root,output)
    if(options.write){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes)}
    else if(!fs.existsSync(file)||!fs.readFileSync(file).equals(bytes))throw Error('TEMPLATE_ASSET_GENERATED_STALE: '+output)
  }
  return {name:PACKAGE_NAME,version:PACKAGE_VERSION,graphs,
    files:[...outputs].map(([output,bytes])=>({path:output,sha256:digest(bytes)})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)}
}

/** Product assembly delegates full published WASM/FFI closure to the existing
 * lock-audited, offline, no-lifecycle-script copier. No private vendor list. */
export function materializeTavernTemplateRuntimeDependenciesV1(options:{repo:string;plan:TavernTemplateRuntimeAssetPlanV1;
  packageRoot:string;libraryRoot:string;admit:(file:string,bytes:Buffer)=>boolean}) {
  const repo=fs.realpathSync(options.repo),recipe=templateRuntimeRecipeV1(options.plan)
  if(!recipe)throw Error('TEMPLATE_ASSET_RECIPE_MISSING')
  metadataAt(repo,options.plan,recipe)
  const libraryRoot=fs.realpathSync(options.libraryRoot)
  const {lockPath}=libraryPins(repo,options.plan,recipe,libraryRoot)
  const result=materializeBundledLibraries({libraryRoot,moduleRoot:inside(path.resolve(options.packageRoot),'node_modules'),
    lockFile:lockPath,libraries:recipe.dependencies,admit:options.admit})
  if(result.packages.length!==3||result.packages.some(item=>!Object.hasOwn(PINS,item.name)
    ||item.version!==PINS[item.name as keyof typeof PINS]||item.path!==item.name)) {
    throw Error('TEMPLATE_ASSET_DELIVERED_DEPENDENCY_GRAPH_INVALID')
  }
  for(const item of result.packages)if(!item.files.some(file=>file.path==='LICENSE')
    ||!item.files.some(file=>file.path==='package.json'))throw Error('TEMPLATE_ASSET_DELIVERED_LICENSE_INVALID')
  const sync=result.packages.find(item=>item.name==='@jitl/quickjs-wasmfile-release-sync')!
  for(const file of ['dist/index.mjs','dist/index.js','dist/ffi.mjs','dist/ffi.js',
    'dist/emscripten-module.mjs','dist/emscripten-module.cjs','dist/emscripten-module.wasm']) {
    if(!sync.files.some(item=>item.path===file))throw Error('TEMPLATE_ASSET_WASM_FFI_INCOMPLETE')
  }
  return result
}

/** Fail before a product inventory can bless a partial/unregistered component.
 * The ordinary product assembler computes the final complete files/generation. */
export function assertTavernTemplateRuntimePackageV1(options:{repo:string;plan:TavernTemplateRuntimeAssetPlanV1;packageRoot:string}):void {
  const recipe=templateRuntimeRecipeV1(options.plan)
  if(!recipe)throw Error('TEMPLATE_ASSET_RECIPE_MISSING')
  const root=fs.realpathSync(options.packageRoot)
  const expected=metadataAt(fs.realpathSync(options.repo),options.plan,recipe)
  const actual=json<Metadata>(inside(root,'package.json'))
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('TEMPLATE_ASSET_DELIVERED_METADATA_CHANGED')
  const files=regularPackageFiles(root)
  for(const file of ['LICENSE','NOTICE.md',...Object.values(MODULES),recipe.descriptorOutput,recipe.sourceInputOutput]) {
    if(!files.includes(file))throw Error('TEMPLATE_ASSET_DELIVERY_INCOMPLETE: '+file)
  }
  const sourceInputs=json<{schemaVersion?:number;encoding?:string;graphs?:Record<string,{artifact:string;path:string;sha256:string}[]>}>(
    inside(root,recipe.sourceInputOutput))
  if(sourceInputs.schemaVersion!==1||sourceInputs.encoding!=='owned-template-component-source-inputs-v1'
    ||!sourceInputs.graphs||JSON.stringify(Object.keys(sourceInputs.graphs).sort())!==JSON.stringify(Object.keys(MODULES).sort())) {
    throw Error('TEMPLATE_ASSET_DELIVERED_SOURCE_GRAPH_INVALID')
  }
  const packageRow=options.plan.product.packages.find(row=>row.packageArtifact===recipe.packageArtifact)!
  const resourceRows=packageRow.resources??[]
  for(const graph of Object.values(sourceInputs.graphs)) {
    if(!Array.isArray(graph)||!graph.length||new Set(graph.map(row=>row.path)).size!==graph.length) {
      throw Error('TEMPLATE_ASSET_DELIVERED_SOURCE_GRAPH_INVALID')
    }
    for(const row of graph) {
      // Frozen source-inputs keep the producer's logical artifact IDs. The
      // manifest supplies the exact historical bytes at the same delivery path.
      const delivered=resourceRows.filter(resource=>resource.path===row.path
        &&(packageRow.immutableGeneration||resource.artifact===row.artifact))
      if(!safe(row.path)||!row.path.startsWith('src/')||!/^[a-f0-9]{64}$/.test(row.sha256)
        ||delivered.length!==1
        ||digest(fs.readFileSync(inside(root,row.path)))!==row.sha256
        ||digest(fs.readFileSync(inside(options.repo,uniqueArtifact(options.plan,delivered[0]!.artifact).source)))!==row.sha256) {
        throw Error('TEMPLATE_ASSET_DELIVERED_SOURCE_CHANGED')
      }
    }
  }
}
