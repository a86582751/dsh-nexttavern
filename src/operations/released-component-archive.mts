/** Published component bytes come from their exact tarball, never today's plan. */
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {resolvePython} from './tool-resolution.mjs'
import {protectedGeneration} from './protected-packages.mjs'
import type {PublishedArchiveInspection,ReleasedComponentRef} from './released-component-types.mjs'

const helper=fileURLToPath(new URL('../../operations/release-archive.py',import.meta.url))
const archiveJob=<T,>(job:unknown):T=>JSON.parse(execFileSync(resolvePython(),[helper],{
  input:JSON.stringify(job),encoding:'utf8',maxBuffer:32*1024*1024,stdio:['pipe','pipe','pipe'],
})) as T

export function inspectPublishedArchive(archive:string,expectedSha256?:string,
  proof:{integrity?:string;shasum?:string}={}):PublishedArchiveInspection {
  archive=path.resolve(archive)
  const facts=archiveJob<Omit<PublishedArchiveInspection,'archive'>>({action:'inspect',archive,expectedSha256,...proof})
  if(facts.provenance.schemaVersion!==1||facts.inventory.schemaVersion!==1
    ||!Array.isArray(facts.inventory.packages)||typeof facts.metadata.name!=='string'
    ||typeof facts.metadata.version!=='string'||facts.inventory.productVersion!==facts.metadata.version
    ||facts.provenance.version!==facts.metadata.version)throw Error('Published archive identity metadata differs')
  return {archive,...facts}
}

export function extractReleasedArchiveComponents(options:{inspection:PublishedArchiveInspection;
  components:readonly {ref:ReleasedComponentRef;output:string}[]}):void {
  if(!options.components.length)return
  const {inspection}=options
  const packages=new Map(inspection.inventory.packages.map(row=>[row.name,row]))
  if(packages.size!==inspection.inventory.packages.length)throw Error('Published component inventory repeats a package name')
  const generations=new Map<string,string>()
  const components=options.components.map(({ref,output})=>{
    const row=packages.get(ref.name)
    if(!row)throw Error('Published component is not inventoried: '+ref.name)
    let generation=generations.get(row.name)
    if(generation===undefined){generation=protectedGeneration(row);generations.set(row.name,generation)}
    if(generation!==ref.generation)throw Error('Published component generation differs: '+ref.name)
    return {prefix:inspection.rootPrefix+'node_modules/'+row.name+'/',output:path.resolve(output),files:row.files}
  })
  archiveJob({action:'extract-components',archive:inspection.archive,components})
}
