/** A producer sees the original manifest identities while historical bindings
 * select the bytes. Snapshot directories never become import-resolution roots. */
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import type {Plugin,Loader} from 'esbuild'
import type {AuthorHostRuntimeAssetRecipeV5} from './author-host-runtime-assets.mjs'

export interface RuntimeAssetSourceArtifactV1 {id:string;source:string;canonicalSource?:string}
export interface HistoricalRuntimeSourceBindingV1 {
  logicalArtifact:string
  sourceArtifact:string
  sha256:string
}
interface HistoricalRuntimeAssetRebuildCommonV1 {
  schemaVersion:1
  packageArtifact:string
  expectedGeneration:string
  sourceBindings:readonly HistoricalRuntimeSourceBindingV1[]
}
export type HistoricalRuntimeAssetRebuildV1=HistoricalRuntimeAssetRebuildCommonV1&(
  {producer:'schema-runtime'}|{producer:'author-host-runtime';recipe:AuthorHostRuntimeAssetRecipeV5})

export function createRuntimeAssetSourceScopeV1(options:{repo:string;
  artifacts:readonly RuntimeAssetSourceArtifactV1[];
  sourceBindings?:readonly HistoricalRuntimeSourceBindingV1[]}) {
  const repo=path.resolve(options.repo)
  const artifacts=new Map(options.artifacts.map(row=>[row.id,row]))
  const logicalFiles=new Map(options.artifacts.map(row=>[
    path.resolve(repo,row.canonicalSource??row.source),row]))
  const sourceFiles=new Map(options.artifacts.map(row=>[path.resolve(repo,row.source),row]))
  const bindings=new Map<string,HistoricalRuntimeSourceBindingV1>()
  const bytesByArtifact=new Map<string,Buffer>()
  const hashesByArtifact=new Map<string,string>()
  const find=(id:string)=>{
    const row=artifacts.get(id)
    if(!row)throw Error('RUNTIME_ASSET_SOURCE_ARTIFACT_UNKNOWN: '+id)
    return row
  }
  const read=(row:RuntimeAssetSourceArtifactV1)=>{
    let bytes=bytesByArtifact.get(row.id)
    if(!bytes){bytes=fs.readFileSync(path.resolve(repo,row.source));bytesByArtifact.set(row.id,bytes)}
    return bytes
  }
  const sha256=(row:RuntimeAssetSourceArtifactV1)=>{
    let hash=hashesByArtifact.get(row.id)
    if(hash===undefined){hash=createHash('sha256').update(read(row)).digest('hex');hashesByArtifact.set(row.id,hash)}
    return hash
  }
  for(const binding of options.sourceBindings??[]) {
    find(binding.logicalArtifact)
    const physical=find(binding.sourceArtifact)
    if(sha256(physical)!==binding.sha256) {
      throw Error('RUNTIME_ASSET_SOURCE_BINDING_SHA: '+binding.sourceArtifact)
    }
    bindings.set(binding.logicalArtifact,binding)
  }
  const entry=(artifactId:string)=>{
    const row=find(artifactId)
    return path.resolve(repo,row.canonicalSource??row.source)
  }
  const input=(logicalFile:string)=>{
    const artifact=logicalFiles.get(path.resolve(logicalFile))
    if(!artifact)throw Error('RUNTIME_ASSET_SOURCE_UNREGISTERED: '+logicalFile)
    const binding=bindings.get(artifact.id)
    const physicalArtifact=binding?find(binding.sourceArtifact):artifact
    return {artifact,physicalArtifact,physicalFile:path.resolve(repo,physicalArtifact.source),bytes:read(physicalArtifact),
      get sha256(){return sha256(physicalArtifact)}}
  }
  const match=(file:string)=>{
    // Match esbuild's source-extension substitution before falling back to
    // installed packages. All matches come from the manifest, including public
    // layouts where the canonical directory does not physically exist.
    const candidates=[file]
    if(file.endsWith('.js'))candidates.push(file.slice(0,-3)+'.ts',file.slice(0,-3)+'.tsx')
    else if(file.endsWith('.mjs'))candidates.push(file.slice(0,-4)+'.mts')
    else if(file.endsWith('.cjs'))candidates.push(file.slice(0,-4)+'.cts')
    else if(!path.extname(file)) {
      const extensions=['.tsx','.ts','.jsx','.js','.json','.mts','.mjs','.cts','.cjs']
      candidates.push(...extensions.map(extension=>file+extension),
        ...extensions.map(extension=>path.join(file,'index'+extension)))
    }
    for(const candidate of candidates)if(logicalFiles.has(candidate))return candidate
    return undefined
  }
  const plugin:Plugin={name:'runtime-asset-source-scope-v1',setup(build){
    build.onResolve({filter:/.*/},async args=>{
      if(args.pluginData?.runtimeAssetSourceResolution)return
      const importer=logicalFiles.get(args.importer)
      const relative=args.path.startsWith('./')||args.path.startsWith('../')
      const candidate=path.isAbsolute(args.path)?args.path
        :relative?path.resolve(path.dirname(args.importer),args.path):undefined
      const logical=candidate&&match(candidate)
      if(logical)return {path:logical,namespace:'file'}
      // Default resolution belongs to the original artifact's physical layout,
      // never to the historical replacement. This preserves bare externals and
      // package lookup without copying an entire historical source tree.
      const physicalImporter=importer?path.resolve(repo,importer.source):args.importer
      const result=await build.resolve(args.path,{kind:args.kind,namespace:args.namespace,
        importer:physicalImporter,resolveDir:importer?path.dirname(physicalImporter):args.resolveDir,
        pluginData:{runtimeAssetSourceResolution:true}})
      if(result.external||result.errors.length)return result
      const registered=sourceFiles.get(path.resolve(result.path))
      return registered?{...result,path:entry(registered.id)}:result
    })
    build.onLoad({filter:/.*/,namespace:'file'},args=>{
      if(!logicalFiles.has(args.path))return
      const source=input(args.path),extension=path.extname(args.path)
      const loader:Loader=extension==='.json'?'json':extension==='.tsx'?'tsx'
        :['.ts','.mts','.cts'].includes(extension)?'ts':extension==='.jsx'?'jsx':'js'
      return {contents:source.bytes,loader,resolveDir:path.dirname(path.resolve(repo,source.artifact.source))}
    })
  }}
  return {entry,plugin,input}
}
