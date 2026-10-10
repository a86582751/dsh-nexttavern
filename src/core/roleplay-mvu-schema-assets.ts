/** Resolve the schema engine from this admitted product, never a profile,
 * build-tools, card path or optional dependency discovered on the host. */
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath,pathToFileURL} from 'node:url'
import type {MvuSchemaRuntime,OwnedSchemaPackageInventory}
  from 'dsh-nexttavern-mvu-schema-runtime'
import type {MvuSchemaRuntimeV2,OwnedSchemaPackageInventory as OwnedSchemaPackageInventoryV2}
  from 'dsh-nexttavern-mvu-schema-runtime-v2'
import type {MvuSchemaRuntimeV3,OwnedSchemaPackageInventory as OwnedSchemaPackageInventoryV3}
  from 'dsh-nexttavern-mvu-schema-runtime-v3'
import type {MvuSchemaRuntimeV4}
  from 'dsh-nexttavern-mvu-schema-runtime-v4'
import {deriveOwnedStateLoaderIdentityV4} from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaCandidateCompilerV4,MvuSchemaCompilationInputV4}
  from './tavern-mvu-schema-program-v4.js'
import {recordSha256} from './roleplay-data.js'
import type {SchemaExecutorVersion,SchemaExecutorIdentityTuple,OwnedMvuSchemaExecutor}
  from './roleplay-mvu-schema-executor-types.js'
import {validateSchemaExecutorIdentityTuple} from './roleplay-mvu-schema-executor-types.js'

const packageName='dsh-nexttavern-mvu-schema-runtime'
const policyPackageName=packageName+'-v4-server-candidates-v2'
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
  type AdmittedRuntime={version:SchemaExecutorVersion;runtime:MvuSchemaRuntime|MvuSchemaRuntimeV2|MvuSchemaRuntimeV3|MvuSchemaRuntimeV4;
    executor:OwnedMvuSchemaExecutor}
  const runtimes=new Map<string,Promise<AdmittedRuntime>>()
  async function load(version:SchemaExecutorVersion,name:string):Promise<AdmittedRuntime> {
    const packageVersion=version===4?'0.4.0':'0.3.0'
    const root=productRoot(name,packageVersion),require=createRequire(path.join(root,'package.json'))
    const metadataPath=fs.realpathSync(require.resolve(name+'/package.json'))
    const owned=fs.realpathSync(path.join(root,'node_modules',name))
    if(metadataPath!==path.join(owned,'package.json'))throw Error('SCHEMA_RUNTIME_PACKAGE_OWNER_CHANGED')
    const entry=fs.realpathSync(require.resolve(name))
    const relative=path.relative(owned,entry)
    if(path.isAbsolute(relative)||relative==='..'||relative.startsWith('..'+path.sep)) {
      throw Error('SCHEMA_RUNTIME_ENTRY_OWNER_CHANGED')
    }
    const bootstrap=await import(pathToFileURL(path.join(root,'lib/operations/bundled-package-bootstrap.mjs')).href) as
      typeof import('../operations/bundled-package-bootstrap.mjs')
    const protection=await import(pathToFileURL(path.join(root,'lib/operations/protected-packages.mjs')).href) as
      typeof import('../operations/protected-packages.mjs')
    const verify=()=>{
      const identity=bootstrap.readBundleIdentity(root)
      const specs=identity.packages.filter(spec=>spec.name===name)
      if(identity.productRoot!==root||specs.length!==1||specs[0]!.version!==packageVersion
        ||fs.realpathSync(require.resolve(name+'/package.json'))!==metadataPath
        ||fs.realpathSync(path.join(root,'node_modules',name))!==owned) {
        throw Error('SCHEMA_RUNTIME_INVENTORY_OWNER_CHANGED')
      }
      const spec=specs[0]!
      protection.verifyProtectedPackage(owned,spec)
      return {name,version:packageVersion,files:structuredClone(spec.files),generation:spec.generation}
    }
    const inventory=verify()
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
      const module=await import(pathToFileURL(entry).href) as typeof import('dsh-nexttavern-mvu-schema-runtime')
      if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
      loaded=await module.createMvuSchemaRuntime({verifyOwnedPackage:fixed=>verifyOwnedPackage(fixed) as OwnedSchemaPackageInventory})
    }else if(version===2) {
      const module=await import(pathToFileURL(entry).href) as typeof import('dsh-nexttavern-mvu-schema-runtime-v2')
      if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
      loaded=await module.createMvuSchemaRuntimeV2({verifyOwnedPackage:fixed=>verifyOwnedPackage(fixed) as OwnedSchemaPackageInventoryV2})
    }else if(version===3) {
      const module=await import(pathToFileURL(entry).href) as typeof import('dsh-nexttavern-mvu-schema-runtime-v3')
      if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
      loaded=await module.createMvuSchemaRuntimeV3({verifyOwnedPackage:fixed=>verifyOwnedPackage(fixed) as OwnedSchemaPackageInventoryV3})
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
  async function admitted(version:SchemaExecutorVersion,
    name=version===4?policyPackageName:version===1?packageName:packageName+'-v'+version):Promise<AdmittedRuntime> {
    if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
    let pending=runtimes.get(name)
    if(!pending) {
      pending=load(version,name).catch(error=>{runtimes.delete(name);throw error})
      runtimes.set(name,pending)
    }
    const actual=await pending
    if(closed)throw Error('SCHEMA_RUNTIME_DISPOSED')
    return actual
  }
  return {
    /** Existing v1 callers remain explicit during migration. New preparation
     * uses getDefaultForNewRealm; historical lookup never consults that default. */
    async get():Promise<MvuSchemaRuntime> {
      return (await admitted(1)).runtime as MvuSchemaRuntime
    },
    async getDefaultForNewRealm(version:3|4=3):Promise<OwnedMvuSchemaExecutor> {
      return (await admitted(version)).executor
    },
    async getHistoricalV1():Promise<OwnedMvuSchemaExecutor> {
      return (await admitted(1)).executor
    },
    async getForVerifiedEpoch(tuple:SchemaExecutorIdentityTuple):Promise<OwnedMvuSchemaExecutor> {
      // A persisted tuple is only lookup data. Core still proves its Source,
      // cut and actual replay before minting process-private publication evidence.
      try {
        // Snapshot bounded lookup data before package admission can yield. A
        // malformed or later-mutated tuple cannot leak a different failure ABI.
        const verified=validateSchemaExecutorIdentityTuple(tuple)
        const version=verified.runner.version as SchemaExecutorVersion
        const implementationKey=recordSha256(verified)
        let name:string|undefined
        if(version===4) {
          const root=productRoot(policyPackageName,'0.4.0')
          const bootstrap=await import(pathToFileURL(path.join(root,'lib/operations/bundled-package-bootstrap.mjs')).href) as
            typeof import('../operations/bundled-package-bootstrap.mjs')
          const entry=bootstrap.readBundleIdentity(root).authorRuntimeHistory.find(row=>recordSha256({
            compiler:row.server.compiler,bridge:row.server.bridge,libraries:row.server.libraries,
            runner:row.server.runner})===implementationKey)
          name=entry?.serverPackage
        }
        const actual=(await admitted(version,name)).executor
        if(actual.implementationKey!==implementationKey)throw Error('SCHEMA_HISTORY_EXECUTOR_UNAVAILABLE')
        return actual
      } catch {throw Error('SCHEMA_HISTORY_EXECUTOR_UNAVAILABLE')}
    },
    async dispose():Promise<void> {
      closed=true
      await Promise.all([...runtimes.values()].map(async active=>{
        try {await (await active).runtime.dispose()}catch { /* Loading already refused or revoked. */ }
      }))
    },
  }
}
