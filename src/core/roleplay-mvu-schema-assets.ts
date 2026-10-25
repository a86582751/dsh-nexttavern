/** Resolve the schema engine from this admitted product, never a profile,
 * build-tools, card path or optional dependency discovered on the host. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
import type {MvuSchemaRuntimeV4,OwnedSchemaPackageInventory}
  from 'dsh-nexttavern-mvu-schema-runtime-v4-update-batch-v1'
import type {MvuSchemaCompiler,MvuSchemaRunner,MvuSchemaLibraryIdentity,MvuSchemaImplementationIdentity}
  from './tavern-mvu-schema-types.js'
import type {MvuSchemaRunnerV2} from './tavern-mvu-schema-types-v2.js'
import type {MvuSchemaRunnerV3} from './tavern-mvu-schema-types-v3.js'
import {deriveOwnedStateLoaderIdentityV4} from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaCandidateCompilerV4,MvuSchemaCompilationInputV4}
  from './tavern-mvu-schema-program-v4.js'
import {recordSha256} from './roleplay-data.js'
import {createRoleplayTypeScriptAssetOwner} from './roleplay-typescript-assets.js'
import type {SchemaExecutorVersion,SchemaExecutorIdentityTuple,OwnedMvuSchemaExecutor}
  from './roleplay-mvu-schema-executor-types.js'
import {validateSchemaExecutorIdentityTuple} from './roleplay-mvu-schema-executor-types.js'
import type {ReleasedComponentRef} from '../operations/released-component-types.mjs'

const packageName='dsh-nexttavern-mvu-schema-runtime'
const policyPackageName=packageName+'-v4-update-batch-v1'
// Keep legacy factory signatures narrow without maintaining retired package
// source just to import its structural runtime types.
interface LegacySchemaRuntime<Runner> {
  compiler:MvuSchemaCompiler
  runner:Runner
  libraries:readonly MvuSchemaLibraryIdentity[]
  bridge:MvuSchemaImplementationIdentity
  dispose():Promise<void>
}
type MvuSchemaRuntime=LegacySchemaRuntime<MvuSchemaRunner>
type MvuSchemaRuntimeV2=LegacySchemaRuntime<MvuSchemaRunnerV2>
type MvuSchemaRuntimeV3=LegacySchemaRuntime<MvuSchemaRunnerV3>
const sameDirectory=(left:URL,right:string)=>left.protocol==='file:'
  &&fs.realpathSync(fileURLToPath(left))===right

function productRoot(name:string,packageVersion:string):string {
  // Root lib/core and preset/lib/core are the two registered delivery layouts.
  // Standalone historical presets and maintenance build-tools are unsupported.
  for(const relative of ['../../','../../../']) {
    const root=fs.realpathSync(fileURLToPath(new URL(relative,import.meta.url)))
    const metadata=path.join(root,'package.json')
    if(!fs.existsSync(metadata))continue
    const value=JSON.parse(fs.readFileSync(metadata,'utf8')) as {name?:string;dependencies?:Record<string,string>}
    if(value.name==='dsh-nexttavern'&&value.dependencies?.[name]===packageVersion)return root
  }
  throw Error('SCHEMA_RUNTIME_PRODUCT_OWNER_UNAVAILABLE')
}

/** Core owns this lazy lifecycle. Revocation during loading disposes the
 * actual factory instead of allowing a delayed import to recreate it. */
export function createRoleplayMvuSchemaAssetOwner() {
  let closed=false
  const typescriptAssets=createRoleplayTypeScriptAssetOwner()
  type AdmittedRuntime={version:SchemaExecutorVersion;runtime:MvuSchemaRuntime|MvuSchemaRuntimeV2|MvuSchemaRuntimeV3|MvuSchemaRuntimeV4;
    executor:OwnedMvuSchemaExecutor}
  const runtimes=new Map<string,Promise<AdmittedRuntime>>()
  const runtimesByIdentity=new Map<string,OwnedMvuSchemaExecutor>()
  type ProductAssets={root:string;require:ReturnType<typeof createRequire>;
    identity:ReturnType<typeof import('../operations/bundled-package-bootstrap.mjs').readBundleIdentity>;
    protection:typeof import('../operations/protected-packages.mjs')}
  let product:Promise<ProductAssets>|undefined
  async function loadProduct(name:string,packageVersion:string):Promise<ProductAssets> {
    const root=productRoot(name,packageVersion),require=createRequire(path.join(root,'package.json'))
    const bootstrap=await import(pathToFileURL(path.join(root,'lib/operations/bundled-package-bootstrap.mjs')).href) as
      typeof import('../operations/bundled-package-bootstrap.mjs')
    const protection=await import(pathToFileURL(path.join(root,'lib/operations/protected-packages.mjs')).href) as
      typeof import('../operations/protected-packages.mjs')
    const identity=bootstrap.readBundleIdentity(root)
    if(identity.productRoot!==root)throw Error('SCHEMA_RUNTIME_INVENTORY_OWNER_CHANGED')
    return {root,require,identity,protection}
  }
  function productAssets(name:string,packageVersion:string):Promise<ProductAssets> {
    // Package generations share this owner's fixed installed product catalog.
    return product??=loadProduct(name,packageVersion).catch(error=>{product=undefined;throw error})
  }
  async function load(version:SchemaExecutorVersion,ref?:ReleasedComponentRef):Promise<AdmittedRuntime> {
    const packageVersion=version===4?'0.4.0':'0.3.0'
    const {root,require,identity,protection}=await productAssets(policyPackageName,packageVersion)
    const selected=ref??identity.currentRuntime?.roles.schema
    const binding=selected?identity.runtimeComponents.get(selected.name+'\0'+selected.generation+'\0'+(selected.context??'')):undefined
    const name=binding?.name??policyPackageName,historical=binding?.path!==undefined
    const specs=selected?binding?[binding]:[]:identity.packages.filter(spec=>spec.name===name)
    if(specs.length!==1||!binding&&specs[0]!.version!==packageVersion
      ||binding&&binding.factory!=='schema-v4-shared-typescript') {
      throw Error('SCHEMA_RUNTIME_INVENTORY_OWNER_CHANGED')
    }
    const spec=specs[0]!
    const owned=fs.realpathSync(binding?.source??path.join(root,'node_modules',name))
    const metadataPath=fs.realpathSync(historical?path.join(owned,'package.json'):require.resolve(name+'/package.json'))
    if(metadataPath!==path.join(owned,'package.json'))throw Error('SCHEMA_RUNTIME_PACKAGE_OWNER_CHANGED')
    const entry=fs.realpathSync(historical?path.join(owned,'dist','index.mjs'):require.resolve(name))
    const relative=path.relative(owned,entry)
    if(path.isAbsolute(relative)||relative==='..'||relative.startsWith('..'+path.sep)) {
      throw Error('SCHEMA_RUNTIME_ENTRY_OWNER_CHANGED')
    }
    protection.verifyProtectedPackage(owned,spec)
    const inventory={name,version:spec.version,files:structuredClone(spec.files),generation:spec.generation}
    if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
    const verifyOwnedPackage=(fixed:URL)=>{
      if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
      if(!sameDirectory(fixed,owned))throw Error('SCHEMA_RUNTIME_PACKAGE_OWNER_CHANGED')
      // Admission owns the fixed inventory for this lifecycle. The immutable
      // provider still checks actual files before loading or executing workers.
      return inventory
    }
    let loaded:MvuSchemaRuntime|MvuSchemaRuntimeV2|MvuSchemaRuntimeV3|MvuSchemaRuntimeV4
    if(version===1) {
      const module=await import(pathToFileURL(entry).href) as {
        createMvuSchemaRuntime(deps:{verifyOwnedPackage(root:URL):ReturnType<typeof verifyOwnedPackage>}):Promise<MvuSchemaRuntime>
      }
      if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
      loaded=await module.createMvuSchemaRuntime({verifyOwnedPackage})
    }else if(version===2) {
      const module=await import(pathToFileURL(entry).href) as {
        createMvuSchemaRuntimeV2(deps:{verifyOwnedPackage(root:URL):ReturnType<typeof verifyOwnedPackage>}):Promise<MvuSchemaRuntimeV2>
      }
      if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
      loaded=await module.createMvuSchemaRuntimeV2({verifyOwnedPackage})
    }else if(version===3) {
      const module=await import(pathToFileURL(entry).href) as {
        createMvuSchemaRuntimeV3(deps:{verifyOwnedPackage(root:URL):ReturnType<typeof verifyOwnedPackage>}):Promise<MvuSchemaRuntimeV3>
      }
      if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
      loaded=await module.createMvuSchemaRuntimeV3({verifyOwnedPackage})
    }else if(binding?.factory==='schema-v4-shared-typescript'||!binding&&name===policyPackageName) {
      const module=await import(pathToFileURL(entry).href) as
        typeof import('dsh-nexttavern-mvu-schema-runtime-v4-update-batch-v1')
      if(binding&&!binding.dependencies.typescript)throw Error('SCHEMA_RUNTIME_TYPESCRIPT_UNAVAILABLE')
      const typescript=await typescriptAssets.get(binding?.dependencies.typescript)
      if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
      loaded=await module.createMvuSchemaRuntimeV4({verifyOwnedPackage:fixed=>
        verifyOwnedPackage(fixed) as OwnedSchemaPackageInventory,typescript})
    }else {
      const module=await import(pathToFileURL(entry).href) as {
        createMvuSchemaRuntimeV4(deps:{verifyOwnedPackage(root:URL):ReturnType<typeof verifyOwnedPackage>}):Promise<MvuSchemaRuntimeV4>
      }
      if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
      loaded=await module.createMvuSchemaRuntimeV4({verifyOwnedPackage})
    }
    if(closed) {await loaded.dispose();throw Error('SCHEMA_RUNTIME_DISPOSED')}
    const tuple:SchemaExecutorIdentityTuple={compiler:loaded.compiler.identity,bridge:loaded.bridge,
      libraries:loaded.libraries,runner:loaded.runner.identity}
    if(tuple.compiler.version!==version||tuple.bridge.version!==version||tuple.runner.version!==version) {
      await loaded.dispose();throw Error('SCHEMA_RUNTIME_IMPLEMENTATION_VERSION_CHANGED')
    }
    if(version===4) {
      try {
        if(!('stateLoader' in loaded)
          ||recordSha256(loaded.stateLoader)!==recordSha256(deriveOwnedStateLoaderIdentityV4(loaded.bridge))) {
          throw Error('SCHEMA_RUNTIME_STATE_LOADER_CHANGED')
        }
      }catch {
        await loaded.dispose();throw Error('SCHEMA_RUNTIME_STATE_LOADER_CHANGED')
      }
    }
    // Each guest ABI remains narrow. The private adapter checks the envelope
    // before selecting a runner; a union never enables implicit wire upgrade.
    const executor:OwnedMvuSchemaExecutor={executorVersion:version,implementationKey:recordSha256(tuple),
      compiler:{identity:loaded.compiler.identity,
        // Preserve the admitted compiler's actual optional surface, including
        // historical candidate generations; older executors expose no method.
        ...(version===4&&'partitionCandidates' in loaded.compiler?{
          async partitionCandidates(input:MvuSchemaCompilationInputV4,signal?:AbortSignal) {
            if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
            return ((loaded as MvuSchemaRuntimeV4).compiler as MvuSchemaCandidateCompilerV4)
              .partitionCandidates(input,signal)
          },
        }:{}),
        async compile(input,signal) {
          if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
          if(version===4&&input.schemaVersion===2)return (loaded as MvuSchemaRuntimeV4).compiler.compile(input,signal)
          if(input.schemaVersion!==1)return {kind:'refused',diagnostics:[{code:'SCHEMA_EXECUTOR_VERSION_MISMATCH'}]}
          if(version===1)return (loaded as MvuSchemaRuntime).compiler.compile(input,signal)
          if(version===2)return (loaded as MvuSchemaRuntimeV2).compiler.compile(input,signal)
          if(version===3)return (loaded as MvuSchemaRuntimeV3).compiler.compile(input,signal)
          return {kind:'refused',diagnostics:[{code:'SCHEMA_EXECUTOR_VERSION_MISMATCH'}]}
        },
        async verifyProgram(program,signal) {
          if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
          if(version===4&&program.schemaVersion===2)return (loaded as MvuSchemaRuntimeV4).compiler.verifyProgram(program,signal)
          if(program.schemaVersion!==1)return false
          if(version===1)return (loaded as MvuSchemaRuntime).compiler.verifyProgram(program,signal)
          if(version===2)return (loaded as MvuSchemaRuntimeV2).compiler.verifyProgram(program,signal)
          if(version===3)return (loaded as MvuSchemaRuntimeV3).compiler.verifyProgram(program,signal)
          return false
        },dispose:()=>loaded.compiler.dispose()},libraries:loaded.libraries,bridge:loaded.bridge,
      ...(version===4?{stateLoader:(loaded as MvuSchemaRuntimeV4).stateLoader}:{}),
      runner:{identity:loaded.runner.identity,
        openManualRun:version===4&&(loaded as MvuSchemaRuntimeV4).runner.openManualRun
          ?async(program,input,signal)=>{
            if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
            if(input.schemaVersion!==4||program.schemaVersion!==2) {
              return {kind:'unavailable',diagnostics:[{code:'SCHEMA_EXECUTOR_VERSION_MISMATCH'}]}
            }
            return (loaded as MvuSchemaRuntimeV4).runner.openManualRun!(program,input,signal)
          }:undefined,
        evaluateNext:version===4&&(loaded as MvuSchemaRuntimeV4).runner.evaluateNext
          ?async(program,input,signal)=>{
            if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
            if(input.schemaVersion!==4||program.schemaVersion!==2) {
              return {kind:'unavailable',diagnostics:[{code:'SCHEMA_EXECUTOR_VERSION_MISMATCH'}]}
            }
            return (loaded as MvuSchemaRuntimeV4).runner.evaluateNext!(program,input,signal)
          }:undefined,
        async evaluateTrace(program,input,signal) {
          if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
          if(input.schemaVersion!==version)return {kind:'unavailable',diagnostics:[{code:'SCHEMA_EXECUTOR_VERSION_MISMATCH'}]}
          // The admitted provider verifies the full owned package before and
          // after each call; the adapter only owns lifecycle and ABI selection.
          if(input.schemaVersion===1&&version===1&&program.schemaVersion===1)return (loaded as MvuSchemaRuntime).runner.evaluateTrace(program,input,signal)
          if(input.schemaVersion===2&&version===2&&program.schemaVersion===1)return (loaded as MvuSchemaRuntimeV2).runner.evaluateTrace(program,input,signal)
          if(input.schemaVersion===3&&version===3&&program.schemaVersion===1)return (loaded as MvuSchemaRuntimeV3).runner.evaluateTrace(program,input,signal)
          if(input.schemaVersion===4&&version===4&&program.schemaVersion===2)return (loaded as MvuSchemaRuntimeV4).runner.evaluateTrace(program,input,signal)
          return {kind:'unavailable',diagnostics:[{code:'SCHEMA_EXECUTOR_VERSION_MISMATCH'}]}
        },
        async verifyTrace(program,evaluation,signal) {
          if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
          if(evaluation.schemaVersion===1&&version===1&&program.schemaVersion===1)return (loaded as MvuSchemaRuntime).runner.verifyTrace(program,evaluation,signal)
          if(evaluation.schemaVersion===2&&version===2&&program.schemaVersion===1)return (loaded as MvuSchemaRuntimeV2).runner.verifyTrace(program,evaluation,signal)
          if(evaluation.schemaVersion===3&&version===3&&program.schemaVersion===1)return (loaded as MvuSchemaRuntimeV3).runner.verifyTrace(program,evaluation,signal)
          if(evaluation.schemaVersion===4&&version===4&&program.schemaVersion===2)return (loaded as MvuSchemaRuntimeV4).runner.verifyTrace(program,evaluation,signal)
          return false
        }},dispose:()=>loaded.dispose()}
    return {version,runtime:loaded,executor}
  }
  async function admitted(version:SchemaExecutorVersion,ref?:ReleasedComponentRef):Promise<AdmittedRuntime> {
    if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
    // ABI1–3 were retired before release. Their lookup entry points remain
    // explicit failures and must never select the current executor instead.
    if(version!==4)throw Error('SCHEMA_HISTORY_EXECUTOR_UNAVAILABLE')
    const selected=ref??(await productAssets(policyPackageName,'0.4.0')).identity.currentRuntime?.roles.schema
    const key=selected?selected.name+'\0'+selected.generation+'\0'+(selected.context??''):'default'
    let pending=runtimes.get(key)
    if(!pending) {
      pending=load(version,selected).then(actual=>{
        runtimesByIdentity.set(actual.executor.implementationKey,actual.executor)
        return actual
      }).catch(error=>{runtimes.delete(key);throw error})
      runtimes.set(key,pending)
    }
    const actual=await pending
    if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
    return actual
  }
  return {
    getTypeScript:(ref?:ReleasedComponentRef)=>typescriptAssets.get(ref),
    /** Retain the legacy signatures as unavailable lookups. New preparation
     * uses ABI4; an old request never implicitly upgrades to that default. */
    async get():Promise<MvuSchemaRuntime> {
      return (await admitted(1)).runtime as MvuSchemaRuntime
    },
    async getDefaultForNewRealm(version:3|4=4):Promise<OwnedMvuSchemaExecutor> {
      return (await admitted(version)).executor
    },
    async getHistoricalV1():Promise<OwnedMvuSchemaExecutor> {
      return (await admitted(1)).executor
    },
    async getForVerifiedEpoch(tuple:SchemaExecutorIdentityTuple):Promise<OwnedMvuSchemaExecutor> {
      // A persisted tuple is only lookup data. Core still proves its Source,
      // cut and actual replay before minting process-private publication evidence.
      try {
        if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
        // Snapshot bounded lookup data before package admission can yield. A
        // malformed or later-mutated tuple cannot leak a different failure ABI.
        const verified=validateSchemaExecutorIdentityTuple(tuple)
        const version=verified.runner.version as SchemaExecutorVersion
        const implementationKey=recordSha256(verified)
        const known=runtimesByIdentity.get(implementationKey)
        if(known)return known
        let component:ReleasedComponentRef|undefined
        if(version===4) {
          const {identity}=await productAssets(policyPackageName,'0.4.0')
          const entry=identity.releasedRuntime?.schemas.find(row=>recordSha256({
            compiler:row.server.compiler,bridge:row.server.bridge,libraries:row.server.libraries,
            runner:row.server.runner})===implementationKey)
          component=entry?.component
        }
        const actual=(await admitted(version,component)).executor
        if(actual.implementationKey!==implementationKey)throw Error('SCHEMA_HISTORY_EXECUTOR_UNAVAILABLE')
        return actual
      } catch {
        if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
        throw Error('SCHEMA_HISTORY_EXECUTOR_UNAVAILABLE')
      }
    },
    async dispose():Promise<void> {
      closed=true
      typescriptAssets.dispose()
      await Promise.all([...runtimes.values()].map(async active=>{
        try {await (await active).runtime.dispose()}catch { /* Loading already refused or revoked. */ }
      }))
    },
  }
}
