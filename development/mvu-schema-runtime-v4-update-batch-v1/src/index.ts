/** Trusted factory over one already-inventoried product dependency. No caller
 * may select worker/library paths or promote an arbitrary directory's hashes. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {SCHEMA_RUNTIME_NAME,SCHEMA_RUNTIME_VERSION,SCHEMA_RUNTIME_DESCRIPTOR,SCHEMA_RUNTIME_PINS,
  schemaAssetSha,schemaAssetPath,schemaRuntimeImplementation} from './descriptor.js'
import type {SchemaRuntimeDescriptor,SchemaRuntimeFile} from './descriptor.js'
import type {MvuSchemaLibraryIdentity,MvuSchemaLibraryBytes,
  MvuSchemaImplementationIdentity} from '../../../src/core/tavern-mvu-schema-types.js'
import {deriveOwnedStateLoaderIdentityV4} from '../../../src/core/tavern-mvu-schema-program-v4.js'
import type {MvuSchemaCandidateCompilerV4,CompilerDepsV4,
  CompilationV4,ServerCandidatePartitionV4} from '../../../src/core/tavern-mvu-schema-program-v4.js'
import type {MvuSchemaRunnerV4,MvuSchemaRunnerDepsV4,MvuSchemaRunResultV4,MvuSchemaTraceRunResultV4,
  MvuSchemaNextRunResultV4,MvuSchemaOpenManualRunResultV4}
  from '../../../src/core/tavern-mvu-schema-types-v4.js'

export interface MvuSchemaRuntimeV4Inventory {
  name:typeof SCHEMA_RUNTIME_NAME;version:typeof SCHEMA_RUNTIME_VERSION
  files:readonly SchemaRuntimeFile[];generation:string
}
export type OwnedSchemaPackageInventory=MvuSchemaRuntimeV4Inventory
export interface MvuSchemaRuntimeV4Deps {
  /** Core binds this to the actual product inventory + verifyProtectedPackage. */
  verifyOwnedPackage(packageRootURL:URL):OwnedSchemaPackageInventory
}
export interface MvuSchemaRuntimeV4 {
  compiler:MvuSchemaCandidateCompilerV4;runner:MvuSchemaRunnerV4
  libraries:readonly MvuSchemaLibraryIdentity[];bridge:MvuSchemaImplementationIdentity
  stateLoader:MvuSchemaImplementationIdentity
  dispose():Promise<void>
}
const failure=()=>Error('SCHEMA_RUNTIME_ASSETS_UNAVAILABLE')
const ownRoot=new URL('../',import.meta.url)
// Node caches modules by URL. A changed generation at the same physical URL
// cannot use cached old JS while claiming new byte identities; restart/load
// a distinct protected-generation URL instead.
let loadedGeneration:string|undefined
const pathname=(root:string,relative:string)=>{
  if(!schemaAssetPath(relative))throw failure()
  return path.join(root,...relative.split('/'))
}
function regularFiles(root:string):string[] {
  const files:string[]=[]
  const visit=(directory:string)=>{
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
      const full=path.join(directory,entry.name)
      if(entry.isSymbolicLink())throw failure()
      if(entry.isDirectory())visit(full)
      else if(entry.isFile())files.push(path.relative(root,full).replaceAll('\\','/'))
      else throw failure()
    }
  }
  visit(root)
  return files.sort()
}
function admitted(root:string,deps:MvuSchemaRuntimeV4Deps):MvuSchemaRuntimeV4Inventory {
  const pin=deps.verifyOwnedPackage(new URL(ownRoot))
  if(pin.name!==SCHEMA_RUNTIME_NAME||pin.version!==SCHEMA_RUNTIME_VERSION||!Array.isArray(pin.files))throw failure()
  const files=pin.files.map(file=>({path:file.path,sha256:file.sha256})).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)
  const names=new Set<string>()
  for(const file of files) {
    if(!schemaAssetPath(file.path)||!/^[a-f0-9]{64}$/.test(file.sha256)||names.has(file.path.toLowerCase()))throw failure()
    names.add(file.path.toLowerCase())
    if(schemaAssetSha(fs.readFileSync(pathname(root,file.path)))!==file.sha256)throw failure()
  }
  if(JSON.stringify(regularFiles(root))!==JSON.stringify(files.map(file=>file.path)))throw failure()
  if(schemaAssetSha(JSON.stringify({name:pin.name,version:pin.version,files}))!==pin.generation)throw failure()
  return {...pin,files}
}
function dependencyGraph(root:string):void {
  const require=createRequire(path.join(root,'package.json'))
  for(const [name,version] of Object.entries(SCHEMA_RUNTIME_PINS)) {
    const packageRoot=pathname(root,'node_modules/'+name)
    const metadata=JSON.parse(fs.readFileSync(path.join(packageRoot,'package.json'),'utf8'))
    if(metadata.name!==name||metadata.version!==version)throw failure()
    const entry=fs.realpathSync(require.resolve(name))
    if(!entry.startsWith(fs.realpathSync(packageRoot)+path.sep))throw failure()
  }
  for(const owner of ['quickjs-emscripten-core','@jitl/quickjs-wasmfile-release-sync']) {
    const require=createRequire(pathname(root,'node_modules/'+owner+'/package.json'))
    const ffi=fs.realpathSync(require.resolve('@jitl/quickjs-ffi-types'))
    if(!ffi.startsWith(fs.realpathSync(pathname(root,'node_modules/@jitl/quickjs-ffi-types'))+path.sep))throw failure()
  }
}

export async function createMvuSchemaRuntimeV4(deps:MvuSchemaRuntimeV4Deps):Promise<MvuSchemaRuntimeV4> {
  let compiler:MvuSchemaCandidateCompilerV4|undefined,runner:MvuSchemaRunnerV4|undefined
  try {
    const root=fileURLToPath(ownRoot),pin=admitted(root,deps)
    if(loadedGeneration!==undefined&&loadedGeneration!==pin.generation)throw failure()
    loadedGeneration??=pin.generation
    dependencyGraph(root)
    const descriptor=JSON.parse(fs.readFileSync(pathname(root,SCHEMA_RUNTIME_DESCRIPTOR),'utf8')) as SchemaRuntimeDescriptor
    if(descriptor.schemaVersion!==1||descriptor.name!==pin.name||descriptor.version!==pin.version
      ||JSON.stringify(descriptor.dependencies)!==JSON.stringify(SCHEMA_RUNTIME_PINS))throw failure()
    const entries=Object.values(descriptor.modules)
    if(entries.length!==5||new Set(entries).size!==5||descriptor.modules.provider!=='dist/index.mjs')throw failure()
    for(const entry of entries)if(!entry.startsWith('dist/')||!schemaAssetPath(entry))throw failure()
    if(descriptor.guests.length!==2||new Set(descriptor.guests.map(guest=>guest.kind)).size!==2)throw failure()
    const libraries:MvuSchemaLibraryBytes[]=descriptor.guests.map(guest=>{
      if(guest.packageName!==guest.kind||guest.version!==(guest.kind==='zod'?'4.4.3':'4.18.1')
        ||guest.globalName!==(guest.kind==='zod'?'z':'_'))throw failure()
      const code=fs.readFileSync(pathname(root,guest.path),'utf8')
      if(schemaAssetSha(code)!==guest.sha256||!pin.files.some(file=>file.path===guest.licensePath))throw failure()
      return {kind:guest.kind,packageName:guest.packageName,version:guest.version,globalName:guest.globalName,
        bundleSha256:guest.sha256,code}
    })
    const bridge=Object.freeze({id:'native-mvu-schema-bridge',version:4,
      implementationSha256:schemaRuntimeImplementation('bridge',pin.files)})
    const stateLoader=Object.freeze(deriveOwnedStateLoaderIdentityV4(bridge))
    const compilerModule=await import(pathToFileURL(pathname(root,descriptor.modules.compiler)).href) as {
      createMvuSchemaCompilerV4(deps:CompilerDepsV4):MvuSchemaCandidateCompilerV4}
    const runnerModule=await import(pathToFileURL(pathname(root,descriptor.modules.runner)).href) as {
      createMvuSchemaRunnerV4(deps:MvuSchemaRunnerDepsV4):MvuSchemaRunnerV4}
    if(admitted(root,deps).generation!==pin.generation)throw failure()
    compiler=compilerModule.createMvuSchemaCompilerV4({identity:{id:'native-mvu-schema-compiler',version:4,typescriptVersion:'5.9.3',
      implementationSha256:schemaRuntimeImplementation('compiler',pin.files)},
      workerUrl:pathToFileURL(pathname(root,descriptor.modules['compiler-worker']))})
    runner=runnerModule.createMvuSchemaRunnerV4({identity:{id:'native-mvu-schema-runner',version:4,quickjsVersion:'0.32.0',
      implementationSha256:schemaRuntimeImplementation('runner',pin.files)},bridge,stateLoader,libraries,
      workerUrl:pathToFileURL(pathname(root,descriptor.modules['runner-worker']))})
    // Admission keeps the entire file set and symlink-free paths unchanged;
    // the initial dependency graph therefore still applies to each worker.
    const current=()=>{const now=admitted(root,deps);if(now.generation!==pin.generation)throw failure()}
    const unavailable={kind:'unavailable' as const,diagnostics:[{code:'SCHEMA_RUNTIME_ASSETS_UNAVAILABLE'}]}
    const guarded=async<T,>(action:()=>Promise<T>,fallback:T):Promise<T>=>{
      try {current();const result=await action();current();return result}catch {return fallback}
    }
    const actualCompiler=compiler,actualRunner=runner
    const openManualRun:NonNullable<MvuSchemaRunnerV4['openManualRun']>=async(program,input,signal)=>{
      let opened:Extract<MvuSchemaOpenManualRunResultV4,{kind:'opened-manual-run'}>|undefined
      try {
        current()
        const result=await actualRunner.openManualRun!(program,input,signal)
        if(result.kind==='opened-manual-run')opened=result
        current()
        // This live resource owns its actually loaded Worker. Later advances
        // consume new Native frames without rescanning the protected package.
        return result
      }catch {
        if(opened)try {await opened.run.close()}catch {
          return {kind:'unavailable',diagnostics:[{code:'SCHEMA_WORKER_CLEANUP'}]}
        }
        return unavailable
      }
    }
    let disposal:Promise<void>|undefined
    return {libraries:Object.freeze(libraries.map(({code:_code,...library})=>Object.freeze(library))),bridge,stateLoader,
      compiler:{identity:actualCompiler.identity,
        compile:(input,signal)=>guarded(()=>actualCompiler.compile(input,signal),
          {kind:'refused',diagnostics:unavailable.diagnostics} as CompilationV4),
        partitionCandidates:(input,signal)=>guarded(()=>actualCompiler.partitionCandidates(input,signal),
          {kind:'refused',diagnostics:unavailable.diagnostics} as ServerCandidatePartitionV4),
        verifyProgram:(program,signal)=>guarded(()=>actualCompiler.verifyProgram(program,signal),false),
        dispose:()=>actualCompiler.dispose()},
      runner:{identity:actualRunner.identity,
        evaluate:(program,input,signal)=>guarded(()=>actualRunner.evaluate(program,input,signal),unavailable as MvuSchemaRunResultV4),
        verifyEvaluation:(program,evaluation,signal)=>guarded(()=>actualRunner.verifyEvaluation(program,evaluation,signal),false),
        evaluateTrace:(program,input,signal)=>guarded(()=>actualRunner.evaluateTrace(program,input,signal),unavailable as MvuSchemaTraceRunResultV4),
        evaluateNext:(program,input,signal)=>guarded(()=>actualRunner.evaluateNext!(program,input,signal),unavailable as MvuSchemaNextRunResultV4),
        openManualRun,
        verifyTrace:(program,evaluation,signal)=>guarded(()=>actualRunner.verifyTrace(program,evaluation,signal),false),
        dispose:()=>actualRunner.dispose()},
      dispose(){return disposal??=Promise.all([actualCompiler.dispose(),actualRunner.dispose()]).then(()=>undefined)}}
  } catch {
    await Promise.all([compiler?.dispose(),runner?.dispose()])
    throw failure()
  }
}
