/** Minimal Host5 producer: maintained provider/replay/journal source is one
 * actual bundle. Existing assembly owns package metadata/resources delivery. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'

const packageName='dsh-nexttavern-author-host-runtime-v5',packageVersion='0.5.1'
const providerOutput='dist/index.mjs',sourceInputOutput='assets/source-inputs.json'
interface Artifact {id:string;source:string}
interface Resource {artifact:string;path:string}
interface SourceInput {artifact:string;path:string;sha256:string}
export interface AuthorHostRuntimeAssetRecipeV5 {
  schemaVersion:1
  encoding:'owned-author-host-runtime-recipe-v5'
  packageArtifact:string
  modules:readonly {role:'provider';artifact:string;output:'dist/index.mjs'}[]
  sourceInputOutput:'assets/source-inputs.json'
  lockArtifact:string
  dependencies:Record<string,string>
  builder:{esbuildVersion:'0.24.2';target:'es2023';bundle:true;write:false;legalComments:'none'}
  sourceGraph:'esbuild-metafile-input-sha256'
  dependencyClosure:'bundled-owned-host-source-only'
}
export interface AuthorHostRuntimeAssetPlanV5 {
  artifacts:readonly Artifact[]
  product:{authorHostRuntime?:AuthorHostRuntimeAssetRecipeV5;
    packages:readonly {packageArtifact:string;resources?:readonly Resource[]}[]}
}
const sha=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex')
const safe=(value:string)=>!!value&&!value.includes('\\')&&!value.includes(':')&&!value.startsWith('/')
  &&value.split('/').every(part=>!!part&&part!=='.'&&part!=='..')
function inside(root:string,relative:string):string {
  if(!safe(relative))throw Error('AUTHOR_HOST_ASSET_PATH_INVALID')
  return path.join(root,...relative.split('/'))
}
function artifact(plan:AuthorHostRuntimeAssetPlanV5,id:string):Artifact {
  const found=plan.artifacts.find(row=>row.id===id)
  if(!found)throw Error('AUTHOR_HOST_ASSET_ARTIFACT_UNKNOWN: '+id)
  return found
}
/** Manifest uniqueness and public mappings stay with the existing plan owner;
 * this producer owns only its single provider role and generation recipe. */
export function authorHostRuntimeRecipeV5(plan:AuthorHostRuntimeAssetPlanV5):AuthorHostRuntimeAssetRecipeV5|undefined {
  const recipe=plan.product.authorHostRuntime
  if(!recipe)return undefined
  if(recipe.schemaVersion!==1||recipe.encoding!=='owned-author-host-runtime-recipe-v5'
    ||recipe.modules.length!==1||recipe.modules[0]!.role!=='provider'||recipe.modules[0]!.output!==providerOutput
    ||recipe.sourceInputOutput!==sourceInputOutput||Object.keys(recipe.dependencies).length!==0
    ||recipe.builder.esbuildVersion!=='0.24.2'||recipe.builder.target!=='es2023'
    ||recipe.builder.bundle!==true||recipe.builder.write!==false||recipe.builder.legalComments!=='none'
    ||recipe.sourceGraph!=='esbuild-metafile-input-sha256'||recipe.dependencyClosure!=='bundled-owned-host-source-only') {
    throw Error('AUTHOR_HOST_ASSET_RECIPE_INVALID')
  }
  return recipe
}
export async function buildAuthorHostRuntimeAssetsV5(options:{repo:string;plan:AuthorHostRuntimeAssetPlanV5;
  packageRoot:string;write?:boolean}) {
  const repo=fs.realpathSync(options.repo),recipe=authorHostRuntimeRecipeV5(options.plan)
  if(!recipe)throw Error('AUTHOR_HOST_ASSET_RECIPE_MISSING')
  const packageArtifact=artifact(options.plan,recipe.packageArtifact)
  const metadataBytes=fs.readFileSync(inside(repo,packageArtifact.source))
  const metadata=JSON.parse(metadataBytes.toString('utf8')) as {name:string;version:string;main:string;
    exports:Record<string,string>;dependencies?:Record<string,string>;bundleDependencies?:readonly string[]}
  if(metadata.name!==packageName||metadata.version!==packageVersion||metadata.main!=='./'+providerOutput
    ||metadata.exports['.']!=='./'+providerOutput||metadata.exports['./package.json']!=='./package.json'
    ||Object.keys(metadata.dependencies??{}).length!==0||(metadata.bundleDependencies??[]).length!==0) {
    throw Error('AUTHOR_HOST_ASSET_PACKAGE_INVALID')
  }
  const packageRow=options.plan.product.packages.find(row=>row.packageArtifact===recipe.packageArtifact)
  if(!packageRow)throw Error('AUTHOR_HOST_ASSET_PACKAGE_UNREGISTERED')
  const resources=packageRow.resources??[],prefix=path.posix.dirname(packageArtifact.source)
  for(const output of [providerOutput,sourceInputOutput]) {
    if(!options.plan.artifacts.some(row=>row.source===prefix+'/'+output)) {
      throw Error('AUTHOR_HOST_ASSET_OUTPUT_UNREGISTERED: '+output)
    }
  }
  const lockArtifact=artifact(options.plan,recipe.lockArtifact),lockFile=inside(repo,lockArtifact.source)
  const lockBytes=fs.readFileSync(lockFile),lock=JSON.parse(lockBytes.toString('utf8')) as {
    packages:Record<string,{version?:string}>}
  const require=createRequire(path.join(path.dirname(lockFile),'package.json'))
  const esbuild=require('esbuild') as typeof import('esbuild')
  if(esbuild.version!==recipe.builder.esbuildVersion||lock.packages['node_modules/esbuild']?.version!==esbuild.version) {
    throw Error('AUTHOR_HOST_ASSET_BUILDER_PIN_INVALID')
  }
  const registered=new Map(options.plan.artifacts.map(row=>[path.resolve(inside(repo,row.source)),row]))
  const module=recipe.modules[0]!,entry=inside(repo,artifact(options.plan,module.artifact).source)
  const result=await esbuild.build({absWorkingDir:repo,entryPoints:[entry],bundle:true,platform:'node',format:'esm',
    target:recipe.builder.target,write:false,metafile:true,minifyWhitespace:true,
    tsconfigRaw:{compilerOptions:{}},legalComments:'none'})
  const output=result.outputFiles?.[0]
  if(!output||result.outputFiles?.length!==1||!result.metafile)throw Error('AUTHOR_HOST_ASSET_OUTPUT_INVALID')
  const inputs:SourceInput[]=Object.keys(result.metafile.inputs).map(input=>{
    const file=fs.realpathSync(path.resolve(repo,input)),source=registered.get(file)
    if(!source||!file.startsWith(repo+path.sep)||!/\.(?:ts|mts)$/.test(file)) {
      throw Error('AUTHOR_HOST_ASSET_SOURCE_UNREGISTERED: '+input)
    }
    const resource=resources.find(row=>row.artifact===source.id)
    if(!resource||!resource.path.startsWith('src/')||!safe(resource.path)) {
      throw Error('AUTHOR_HOST_ASSET_SOURCE_RESOURCE_UNREGISTERED: '+source.id)
    }
    return {artifact:source.id,path:resource.path,sha256:sha(fs.readFileSync(file))}
  }).sort((left,right)=>left.path<right.path?-1:left.path>right.path?1:0)
  const graphs={provider:inputs},outputs=new Map<string,Buffer>()
  outputs.set(providerOutput,Buffer.from(output.contents))
  outputs.set(sourceInputOutput,Buffer.from(JSON.stringify({schemaVersion:1,
    encoding:'owned-author-host-runtime-source-inputs-v5',name:packageName,version:packageVersion,
    package:{artifact:recipe.packageArtifact,sha256:sha(metadataBytes)},
    builder:{esbuildVersion:esbuild.version,lock:{artifact:recipe.lockArtifact,sha256:sha(lockBytes)}},
    dependencyClosure:recipe.dependencyClosure,graphs},null,2)+'\n'))
  const root=path.resolve(options.packageRoot)
  for(const [output,bytes] of outputs) {
    const file=inside(root,output)
    if(options.write){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes)}
    else if(!fs.existsSync(file)||!fs.readFileSync(file).equals(bytes))throw Error('AUTHOR_HOST_ASSET_GENERATED_STALE: '+output)
  }
  return {name:packageName,version:packageVersion,graphs,
    files:[...outputs].map(([output,bytes])=>({path:output,sha256:sha(bytes)}))}
}
