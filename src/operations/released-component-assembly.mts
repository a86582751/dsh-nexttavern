/** Bind current producers and retained published bytes to exact local instances. */
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {recordSha256} from '../core/roleplay-data.js'
import {contained} from './public-transaction.mjs'
import {protectedGeneration} from './protected-packages.mjs'
import {readPublishedReleaseCatalog} from './released-component-catalog.mjs'
import {inspectPublishedArchive,extractReleasedArchiveComponents} from './released-component-archive.mjs'
import type {ProductAssemblyPlan} from './product-assembly.mjs'
import type {ProtectedFile} from './protected-packages.mjs'
import type {CurrentRuntimeComponents,PublishedReleaseRecord,ReleasedComponentFactory,ReleasedComponentRef,
  ReleasedRuntimeComponent,ReleasedRuntimeInventory,ReleasedRuntimeRole} from './released-component-types.mjs'

export interface CurrentRuntimePackage {
  packageArtifact:string
  name:string
  version:string
  files:ProtectedFile[]
}
export interface HistoricalReleasedComponent {name:string;version:string;files:ProtectedFile[];path:string}
type RuntimeDescriptor={sharedCompiler?:{name:string;version:string}}
const json=<T,>(file:string)=>JSON.parse(fs.readFileSync(file,'utf8')) as T
const hash=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex')
const refKey=(ref:ReleasedComponentRef)=>ref.name+'\0'+ref.generation+'\0'+(ref.context??'')
const ref=(component:ReleasedComponentRef):ReleasedComponentRef=>({name:component.name,generation:component.generation,
  ...(component.context?{context:component.context}:{})})
const bindingKey=(component:ReleasedRuntimeComponent)=>JSON.stringify([component.version,component.factory,
  component.dependencies.typescript?refKey(component.dependencies.typescript):null])

/** Dependencies give identical payload bytes distinct Node resolution owners. */
export function componentContext(component:Pick<ReleasedRuntimeComponent,'generation'|'factory'|'dependencies'>)
  :string|undefined {
  if(!component.dependencies.typescript)return undefined
  return hash(JSON.stringify({generation:component.generation,factory:component.factory,
    dependencies:{typescript:ref(component.dependencies.typescript)}}))
}

export function describeCurrentRuntimeComponents(options:{plan:ProductAssemblyPlan;packageRoot:string;
  packages:readonly CurrentRuntimePackage[]}):CurrentRuntimeComponents {
  const {plan,packageRoot}=options
  const byArtifact=new Map(options.packages.map(row=>[row.packageArtifact,row]))
  const byName=new Map(options.packages.map(row=>[row.name,row]))
  const result:CurrentRuntimeComponents={schemaVersion:1,components:[],roles:{}}
  const components=new Map<string,ReleasedRuntimeComponent>()
  const generations=new Map<string,string>()
  const generation=(row:CurrentRuntimePackage)=>{
    let value=generations.get(row.name)
    if(value===undefined){value=protectedGeneration(row);generations.set(row.name,value)}
    return value
  }
  const add=(row:CurrentRuntimePackage,factory:ReleasedComponentFactory,
    dependencies:ReleasedRuntimeComponent['dependencies']={}):ReleasedRuntimeComponent=>{
    const component:ReleasedRuntimeComponent={name:row.name,version:row.version,generation:generation(row),factory,dependencies}
    const context=componentContext(component)
    if(context)component.context=context
    const key=refKey(component),known=components.get(key)
    if(known) {
      if(bindingKey(known)!==bindingKey(component))throw Error('Current runtime component has conflicting roles: '+row.name)
      return known
    }
    components.set(key,component);return component
  }
  const schemas=(plan.product.mvuSchemaRuntimes??[]).filter(row=>row.executorVersion===4)
  if(schemas.length>1)throw Error('Current schema runtime recipe is ambiguous')
  const recipes:{role:ReleasedRuntimeRole;artifact?:string;factory:ReleasedComponentFactory;shared?:boolean}[]=[
    {role:'schema',artifact:schemas[0]?.packageArtifact,factory:'schema-v4-shared-typescript',shared:true},
    {role:'host',artifact:plan.product.authorHostRuntime?.packageArtifact,factory:'host-v5'},
    {role:'browser',artifact:plan.product.authorBrowserRuntimeV3?.packageArtifact,
      factory:'browser-v3-shared-typescript',shared:true},
    {role:'browserPartition',artifact:plan.product.authorBrowserRuntimeV2?.packageArtifact,factory:'browser-v2-local-typescript'},
    {role:'prompt',artifact:plan.product.authorPromptRuntime?.packageArtifact,factory:'prompt-v1-shared-typescript',shared:true},
    {role:'template',artifact:plan.product.templateRuntime?.packageArtifact,factory:'template-v2'},
  ]
  for(const recipe of recipes) {
    if(!recipe.artifact)continue
    const row=byArtifact.get(recipe.artifact)
    if(!row)throw Error('Current runtime package was not assembled: '+recipe.artifact)
    const dependencies:ReleasedRuntimeComponent['dependencies']={}
    if(recipe.shared) {
      const descriptor=json<RuntimeDescriptor>(contained(packageRoot,'node_modules/'+row.name+'/assets/runtime.json'))
      const compiler=descriptor.sharedCompiler,typescript=compiler&&byName.get(compiler.name)
      if(!typescript||typescript.version!==compiler!.version)throw Error('Current shared compiler is not assembled: '+row.name)
      const owner=add(typescript,'typescript-v1')
      dependencies.typescript=ref(owner);result.roles.typescript=ref(owner)
    }
    const component=add(row,recipe.factory,dependencies)
    result.roles[recipe.role]=ref(component)
  }
  result.components=[...components.values()]
  return result
}

type DependencyNamespace=NonNullable<ReleasedRuntimeInventory['dependencyNamespaces']>[number]
/** Static worker imports resolve through these admitted, package-external files. */
export function writeReleasedDependencyNamespaces(options:{packageRoot:string;
  components:readonly ReleasedRuntimeComponent[];outputRoot?:string;
  locations?:readonly {ref:ReleasedComponentRef;root:string}[];previous?:readonly DependencyNamespace[];
  onWrite?:(target:string,stagedRoot:string)=>void}):DependencyNamespace[] {
  const components=new Map(options.components.map(component=>[refKey(component),component]))
  const locations=new Map((options.locations??[]).map(row=>[refKey(row.ref),row.root]))
  const previousNamespaces=new Map((options.previous??[]).map(row=>[row.path,row]))
  const metadataByDependency=new Map<string,{name:string;version:string;main:string}>()
  const result:DependencyNamespace[]=[],created:string[]=[]
  try {
    for(const component of components.values()) {
      if(!component.path||!component.dependencies.typescript)continue
      const dependency=components.get(refKey(component.dependencies.typescript))
      if(!dependency)throw Error('Released namespace dependency is unavailable: '+component.name)
      const dependencyKey=refKey(dependency)
      let metadata=metadataByDependency.get(dependencyKey)
      if(!metadata) {
        const targetRoot=locations.get(dependencyKey)??contained(options.packageRoot,
          dependency.path??'node_modules/'+dependency.name)
        metadata=json<{name:string;version:string;main:string}>(path.join(targetRoot,'package.json'))
        metadataByDependency.set(dependencyKey,metadata)
      }
      const target=contained(options.packageRoot,path.posix.join(dependency.path??'node_modules/'+dependency.name,
        metadata.main.replace(/^\.\//,'')))
      const namespace=path.posix.join(path.posix.dirname(component.path),'node_modules',dependency.name)
      let specifier=path.relative(contained(options.packageRoot,namespace),target).replaceAll('\\','/')
      if(!specifier.startsWith('.'))specifier='./'+specifier
      const bytes=new Map([
        ['package.json',Buffer.from(JSON.stringify({name:metadata.name,version:metadata.version,type:'module',
          main:'./index.mjs',exports:{'.':'./index.mjs','./package.json':'./package.json'}},null,2)+'\n')],
        ['index.mjs',Buffer.from('export {default} from '+JSON.stringify(specifier)+';\nexport * from '+JSON.stringify(specifier)+';\n')],
      ])
      const files=[...bytes].map(([file,value])=>({path:file,sha256:hash(value)})).sort((a,b)=>a.path.localeCompare(b.path))
      result.push({component:ref(component),dependency:ref(dependency),path:namespace,files})
      const previous=previousNamespaces.get(namespace)
      if(previous&&JSON.stringify(previous.files)===JSON.stringify(files))continue
      const output=contained(options.outputRoot??options.packageRoot,namespace)
      if(fs.existsSync(output))throw Error('Released dependency namespace output must be new')
      fs.mkdirSync(output,{recursive:true});created.push(output)
      for(const [file,value] of bytes)fs.writeFileSync(path.join(output,file),value,{flag:'wx'})
      options.onWrite?.(namespace,output)
    }
    return result
  }catch(error) {
    for(const directory of created.reverse())if(fs.existsSync(directory))fs.rmSync(directory,{recursive:true,force:true})
    throw error
  }
}

interface MaterializationOptions {
  repo:string
  packageRoot:string
  plan:ProductAssemblyPlan
  currentRuntime:CurrentRuntimeComponents
  currentPackages:readonly {name:string;version:string;files:ProtectedFile[]}[]
  archives:Readonly<Record<string,string>>
  /** Valid ready-state facts supplied by the development transaction owner. */
  previous?:{historicalComponents:readonly HistoricalReleasedComponent[];releasedRuntime?:ReleasedRuntimeInventory}
  /** Incremental callers stage all writes and commit through replaceOwner. */
  stageRoot?:string
  commit?:(target:string,stagedRoot:string)=>void
}

export function materializeReleasedComponents(options:MaterializationOptions):{
  historicalComponents:HistoricalReleasedComponent[];releasedRuntime:ReleasedRuntimeInventory} {
  const catalog=readPublishedReleaseCatalog(options.repo,options.plan)
  const result:ReleasedRuntimeInventory={schemaVersion:1,components:[],releases:[],schemas:[],authors:[],templates:[],
    dependencyNamespaces:[]}
  const current=new Map(options.currentRuntime.components.map(component=>[refKey(component),component]))
  const selected=new Map<string,ReleasedRuntimeComponent>()
  const sources=new Map<string,PublishedReleaseRecord>()
  const specs=new Map<string,HistoricalReleasedComponent>()
  const priorComponents=new Map((options.previous?.releasedRuntime?.components??[]).map(component=>[refKey(component),component]))
  const priorFiles=new Map((options.previous?.historicalComponents??[]).map(component=>[component.path,component]))
  const schemas=new Map<string,ReleasedRuntimeInventory['schemas'][number]>()
  const authors=new Map<string,ReleasedRuntimeInventory['authors'][number]>()
  const templates=new Map<string,ReleasedRuntimeInventory['templates'][number]>()
  const releases=new Set<string>()
  for(const release of catalog.releases) {
    const releaseKey=release.version+'\0'+release.archive.sha256
    if(!releases.has(releaseKey)){result.releases.push({version:release.version,archiveSha256:release.archive.sha256});releases.add(releaseKey)}
    for(const component of release.runtime.components) {
      const key=refKey(component),actual=current.get(key)??selected.get(key)
      if(actual&&bindingKey(actual)!==bindingKey(component))throw Error('Published runtime instance has conflicting dependencies: '+component.name)
      if(selected.has(key))continue
      if(actual)selected.set(key,actual)
      else {
        selected.set(key,{...component,path:'components/'+(component.context??component.generation)+'/package'})
        sources.set(key,release)
      }
    }
    const {identities,roles}=release.runtime
    if(identities.server&&roles.schema) {
      const key=recordSha256(identities.server)
      if(!schemas.has(key))schemas.set(key,{server:identities.server,component:roles.schema})
    }
    if(identities.host&&identities.server) {
      const key=recordSha256({host:identities.host,server:identities.server})
      if(!authors.has(key))authors.set(key,{host:identities.host,server:identities.server,roles})
    }
    if(identities.template&&roles.template) {
      const key=recordSha256(identities.template)
      if(!templates.has(key))templates.set(key,{engine:identities.template,component:roles.template})
    }
  }
  // A reused current package carries its current exact dependency binding.
  // The dependency may be shared by several formal component roles.
  for(const component of selected.values()) {
    const dependency=component.dependencies.typescript
    if(dependency&&!selected.has(refKey(dependency))) {
      const actual=current.get(refKey(dependency))
      if(!actual)throw Error('Published component dependency is unavailable: '+dependency.name)
      selected.set(refKey(dependency),actual)
    }
  }
  const groups=new Map<string,{release:PublishedReleaseRecord;components:ReleasedRuntimeComponent[]}>()
  for(const [key,component] of selected) {
    if(!component.path)continue
    const previous=priorComponents.get(key),files=priorFiles.get(component.path)
    if(previous&&files&&bindingKey(previous)===bindingKey(component)) {
      specs.set(key,files);continue
    }
    const release=sources.get(key)!
    let group=groups.get(release.archive.sha256)
    if(!group){group={release,components:[]};groups.set(release.archive.sha256,group)}
    group.components.push(component)
  }
  const outputRoot=options.stageRoot??options.packageRoot
  const pending:{target:string;staged:string}[]=[]
  const created:string[]=[]
  const physical=new Map<string,string>()
  try {
    for(const group of groups.values()) {
      const release=group.release,archive=options.archives['published:'+release.archive.sha256]
      if(!archive)throw Error('Missing published archive: '+release.archive.sha256)
      const inspection=inspectPublishedArchive(archive,release.archive.sha256)
      if(inspection.metadata.name!==release.packageName||inspection.metadata.version!==release.version
        ||inspection.provenance.sourceCommit!==release.sourceCommit||inspection.rootPrefix!==release.archive.rootPrefix
        ||inspection.bytes!==release.archive.bytes)throw Error('Published archive differs from its recorded release')
      const rows=new Map(inspection.inventory.packages.map(row=>[row.name,row]))
      const outputs=group.components.map(component=>{
        const row=rows.get(component.name)
        if(!row||row.version!==component.version)throw Error('Published component metadata differs: '+component.name)
        const output=contained(outputRoot,component.path!)
        return {ref:ref(component),output}
      })
      extractReleasedArchiveComponents({inspection,components:outputs})
      for(const [index,component] of group.components.entries()) {
        const key=refKey(component),row=rows.get(component.name)!,output=outputs[index]!.output
        specs.set(key,{name:row.name,version:row.version,files:row.files,path:component.path!})
        physical.set(key,output);created.push(output)
        pending.push({target:component.path!,staged:output})
      }
    }
    result.dependencyNamespaces=writeReleasedDependencyNamespaces({packageRoot:options.packageRoot,outputRoot,
      components:[...selected.values()],
      locations:[...selected].flatMap(([key,component])=>physical.has(key)?[{ref:ref(component),root:physical.get(key)!}]:[]),
      ...(options.previous?.releasedRuntime?.dependencyNamespaces?{previous:options.previous.releasedRuntime.dependencyNamespaces}:{}),
      onWrite:(target,staged)=>{created.push(staged);pending.push({target,staged})}})
    if(options.commit)for(const item of pending)options.commit(item.target,item.staged)
  }catch(error) {
    // Only this invocation's new/staged directories are removed. Existing ready
    // payloads remain owned by the caller's development transaction.
    for(const directory of created.reverse())if(fs.existsSync(directory))fs.rmSync(directory,{recursive:true,force:true})
    throw error
  }
  result.components=[...selected.values()]
  result.schemas=[...schemas.values()];result.authors=[...authors.values()];result.templates=[...templates.values()]
  return {historicalComponents:[...specs.values()],releasedRuntime:result}
}
