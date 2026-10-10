/** Actual protected Host5 implementation. The bundled provider includes the
 * same maintained replay/journal source; no lower replay plus JSON stamp can
 * mint its evidence. Source, locks and Native callbacks stay with Core. */
import {recordSha256} from './roleplay-data.js'
import {createCombinedAuthorCompilerV4} from './tavern-author-combined-compiler.mjs'
import {createCombinedAuthorCompilerV5} from './tavern-author-combined-compiler-v5.mjs'
import {createRoleplayMvuSchemaReplay} from './roleplay-mvu-schema-replay.js'
import type {SchemaReplayDeps} from './roleplay-mvu-schema-replay.js'
import type {OwnedMvuSchemaExecutor} from './roleplay-mvu-schema-executor-types.js'
import type {MvuSchemaCompilerV4} from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaImplementationIdentity} from './tavern-mvu-schema-types.js'
import type {BrowserPartitionCompilerV1} from './tavern-author-browser-types.mjs'
import type {BrowserPartitionCompilerV2} from './tavern-author-browser-types-v2.mjs'
import type {CombinedAuthorCompiler} from './tavern-author-combined-types.mjs'
import type {OwnedAuthorPromptRuntimeV1} from './tavern-author-prompt-types.mjs'
import type {AuthorHostIdentityV5,AuthorServerExecutorV4} from './roleplay-author-host-types-v5.js'

export const AUTHOR_HOST_NAME_V5='dsh-nexttavern-author-host-runtime-v5-native-personas-save-codec-v1'
export const AUTHOR_HOST_VERSION_V5='0.5.2'
export interface AuthorHostInventoryV5 {
  name:typeof AUTHOR_HOST_NAME_V5|'dsh-nexttavern-author-host-runtime-v5-policy-init-chat-v1'
    |'dsh-nexttavern-author-host-runtime-v5-policy'|'dsh-nexttavern-author-host-runtime-v5'
  version:typeof AUTHOR_HOST_VERSION_V5
  files:readonly {path:string;sha256:string}[]
  generation:string
}
export type AdmittedAuthorServerV4=OwnedMvuSchemaExecutor&{executorVersion:4;stateLoader:MvuSchemaImplementationIdentity}
export type AuthorHostReplayBindingsV5=Omit<SchemaReplayDeps,'compiler'|'runner'|'executorVersion'|'hostV5'>
export type AuthorHostReplayOwnerV5=ReturnType<typeof createRoleplayMvuSchemaReplay>
export interface AuthorHostRuntimeV5 {
  readonly identity:AuthorHostIdentityV5
  readonly compiler:CombinedAuthorCompiler
  readonly server:AuthorServerExecutorV4
  readonly prompt:OwnedAuthorPromptRuntimeV1
  createReplay(bindings:AuthorHostReplayBindingsV5):AuthorHostReplayOwnerV5
  checkCurrent():void
  dispose():void
}
const ownRoot=new URL('../',import.meta.url)
let loadedGeneration:string|undefined
export async function createOwnedAuthorHostRuntimeV5(deps:{
  verifyOwnedPackage(root:URL):AuthorHostInventoryV5
  server:AdmittedAuthorServerV4
  browser:BrowserPartitionCompilerV1|BrowserPartitionCompilerV2
  prompt:OwnedAuthorPromptRuntimeV1
}):Promise<AuthorHostRuntimeV5> {
  // Core verified these package bytes before import. This one callback fixes
  // the admitted generation; loaded calls never rescan its filesystem.
  const pin=deps.verifyOwnedPackage(new URL(ownRoot))
  if(pin.name!==AUTHOR_HOST_NAME_V5||pin.version!==AUTHOR_HOST_VERSION_V5)throw Error('AUTHOR_HOST_PACKAGE_OWNER_CHANGED')
  if(loadedGeneration!==undefined&&loadedGeneration!==pin.generation)throw Error('AUTHOR_HOST_GENERATION_RESTART_REQUIRED')
  loadedGeneration??=pin.generation
  if(deps.server.executorVersion!==4)throw Error('AUTHOR_HOST_SERVER_ABI_UNSUPPORTED')
  const server:AuthorServerExecutorV4=Object.freeze({compiler:deps.server.compiler.identity as AuthorServerExecutorV4['compiler'],
    bridge:deps.server.bridge,libraries:deps.server.libraries,stateLoader:deps.server.stateLoader,
    runner:deps.server.runner.identity as AuthorServerExecutorV4['runner']})
  const compilerDependencies={server:deps.server.compiler as MvuSchemaCompilerV4,
    prompt:deps.prompt.compiler,implementationSha256:pin.generation}
  const actualCompiler:CombinedAuthorCompiler=deps.browser.runtime.version===2
    ?createCombinedAuthorCompilerV5({...compilerDependencies,browser:deps.browser as BrowserPartitionCompilerV2})
    :createCombinedAuthorCompilerV4({...compilerDependencies,browser:deps.browser as BrowserPartitionCompilerV1})
  const identity:AuthorHostIdentityV5=Object.freeze({id:'native-author-host',version:5,
    implementationSha256:recordSha256({encoding:'native-author-host-implementation-v5',generation:pin.generation,
      combinedCompiler:actualCompiler.identity,server,browser:{compiler:deps.browser.identity,runtime:deps.browser.runtime},
      prompt:{compiler:deps.prompt.compiler.identity,runtime:deps.prompt.runtime}})})
  let disposed=false
  const owners=new Set<AuthorHostReplayOwnerV5>()
  const checkCurrent=()=>{if(disposed)throw Error('AUTHOR_HOST_RUNTIME_DISPOSED')}
  const compiler:AuthorHostRuntimeV5['compiler']={identity:actualCompiler.identity,
    compile(input,signal){checkCurrent();return actualCompiler.compile(input,signal)},
    verifyProgram(program,signal){checkCurrent();return actualCompiler.verifyProgram(program,signal)}}
  return Object.freeze({identity,server,compiler,prompt:deps.prompt,
    createReplay(bindings:AuthorHostReplayBindingsV5) {
      checkCurrent()
      const replay=createRoleplayMvuSchemaReplay({...bindings,compiler:deps.server.compiler,runner:deps.server.runner,
        executorVersion:4,hostV5:{identity,compiler:actualCompiler,server}})
      const dispose=replay.dispose
      replay.dispose=()=>{owners.delete(replay);dispose()}
      owners.add(replay)
      return replay
    },checkCurrent,
    dispose() {
      if(disposed)return
      disposed=true
      for(const replay of owners)replay.dispose()
      owners.clear()
      // Core owns the injected server, Browser and Prompt component lifetimes.
    }})
}
