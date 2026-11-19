/** Live MVU calculations have no Native publication or recovery journal. Their
 * actual attachment and captured Source own the Worker until release. */
import {recordSha256} from './roleplay-data.js'
import type {AuthorNativeMvuHookGraphV1} from './author-native-mvu-hook-graph.js'
import type {Mvu196HookStage} from './tavern-mvu-update-protocol-v1.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {AuthorNativeSnapshotDataV1} from './author-native-helper-types.js'
import type {MvuSchemaTrialRunV4,MvuSchemaTrialInputV4,MvuSchemaOpenTrialResultV4}
  from './tavern-mvu-schema-types-v4.js'
import type {OwnedMvuSchemaExecutor} from './roleplay-mvu-schema-executor-types.js'
import type {MvuExecutableProgramV4} from './tavern-mvu-owned-state-types-v1.mjs'
import {schemaPhaseErrorPolicyForProgramV4,schemaExecutionViewV4} from './tavern-mvu-schema-program-v4.js'
import {createMvuScopeReadFrameV1} from './tavern-mvu-scope-read.js'

export type AuthorMvuTrialRequestV1={readonly trialId:string}&(
  |{readonly action:'start';readonly message:string;readonly oldData:MvuJsonObject;
    readonly interests:readonly Mvu196HookStage[]}
  |{readonly action:'advance';readonly updateId:string;readonly yieldOrdinal:number;
    readonly graph:AuthorNativeMvuHookGraphV1;readonly interests:readonly Mvu196HookStage[]}
  |{readonly action:'close'})
export type AuthorMvuTrialOutputV1=Extract<MvuSchemaOpenTrialResultV4,{kind:'opened-trial'}>['output']
export type AuthorMvuTrialReplyV1={readonly kind:'output';readonly output:AuthorMvuTrialOutputV1}
  |{readonly kind:'closed'}

export interface AuthorMvuTrialSourceV1 {
  readonly program:MvuExecutableProgramV4|null
  readonly runtime:OwnedMvuSchemaExecutor
  readonly macros?:Extract<MvuSchemaTrialInputV4['update'],{encoding:'native-mvu-196-update-start-v1'}>['macros']
  current():boolean
  onInvalidated(abort:()=>void):()=>void
  release():void
}

export function createRoleplayAuthorMvuTrialsV1(deps:{
  prepare(sid:string,snapshot:AuthorNativeSnapshotDataV1,message:string,signal:AbortSignal):Promise<AuthorMvuTrialSourceV1>
}) {
  interface Trial {
    readonly owner:object
    readonly sessionId:string
    readonly trialId:string
    readonly inputSha256:string
    readonly controller:AbortController
    readonly pending:Promise<AuthorMvuTrialReplyV1>
    run?:MvuSchemaTrialRunV4
    source?:AuthorMvuTrialSourceV1
    unwatch?:()=>void
    closing?:Promise<void>
  }
  const owners=new WeakMap<object,Map<string,Trial>>(),active=new Set<Trial>()
  let disposed=false
  function fail(code:string):never {throw Error(code)}
  async function close(trial:Trial):Promise<void> {
    if(trial.closing)return trial.closing
    trial.controller.abort()
    trial.closing=(async()=>{
      // An in-flight open owns its eventual Worker too. Await it before
      // releasing Source so a late open cannot escape attachment cleanup.
      try {await trial.pending}catch{}
      try {await trial.run?.close()}finally {
        trial.unwatch?.();trial.source?.release();active.delete(trial)
        const local=owners.get(trial.owner)
        if(local?.get(trial.trialId)===trial)local.delete(trial.trialId)
      }
    })()
    return trial.closing
  }
  async function handle(owner:object,sid:string,snapshot:AuthorNativeSnapshotDataV1,request:AuthorMvuTrialRequestV1,
    current:()=>boolean,signal:AbortSignal):Promise<AuthorMvuTrialReplyV1> {
    switch(request?.action) {
      case 'close': {
        const trial=owners.get(owner)?.get(request.trialId)
        if(trial)await close(trial)
        return {kind:'closed'}
      }
      case 'advance': {
        signal.throwIfAborted()
        if(disposed||!current())fail('AUTHOR_NATIVE_MVU_TRIAL_REVOKED')
        const trial=owners.get(owner)?.get(request.trialId)
        if(!trial||trial.sessionId!==sid)return fail('AUTHOR_NATIVE_MVU_TRIAL_UNAVAILABLE')
        await trial.pending
        if(!current()||trial.controller.signal.aborted||!trial.source?.current()) {
          await close(trial);return fail('AUTHOR_NATIVE_MVU_TRIAL_REVOKED')
        }
        const output=await trial.run!.advance({schemaVersion:1,encoding:'native-mvu-196-update-resume-v1',
          updateId:request.updateId,yieldOrdinal:request.yieldOrdinal,graph:request.graph,interests:request.interests},signal)
        if(output.kind!=='evaluated-trial')return fail(output.diagnostics[0]?.code??'AUTHOR_NATIVE_MVU_TRIAL_FAILED')
        if(!current()||!trial.source.current()) {await close(trial);return fail('AUTHOR_NATIVE_MVU_TRIAL_REVOKED')}
        return {kind:'output',output:output.output}
      }
      case 'start': {
        signal.throwIfAborted()
        if(disposed||!current())fail('AUTHOR_NATIVE_MVU_TRIAL_REVOKED')
        let local=owners.get(owner)
        if(!local)owners.set(owner,local=new Map())
        const inputSha256=recordSha256(request),existing=local.get(request.trialId)
        if(existing) {
          if(existing.inputSha256!==inputSha256)fail('AUTHOR_NATIVE_MVU_TRIAL_INPUT_CHANGED')
          return existing.pending
        }
        const controller=new AbortController(),ready=Promise.withResolvers<AuthorMvuTrialReplyV1>(),
          trial:Trial={owner,sessionId:sid,trialId:request.trialId,inputSha256,controller,pending:ready.promise}
        local.set(request.trialId,trial);active.add(trial)
        const abort=()=>{controller.abort();void close(trial).catch(()=>{})}
        signal.addEventListener('abort',abort,{once:true})
        void (async()=>{
          try {
            const source=await deps.prepare(sid,snapshot,request.message,controller.signal)
            trial.source=source
            trial.unwatch=source.onInvalidated(abort)
            if(!current()||!source.current())fail('AUTHOR_NATIVE_MVU_TRIAL_REVOKED')
            const {stat_data,...context}=request.oldData,
              runtime=source.runtime,open=runtime.runner.openTrial
            if(!open)return fail('AUTHOR_NATIVE_MVU_TRIAL_UNAVAILABLE')
            let scopeReadFrame=snapshot.scopeFrame
            if(source.program) {
              // Browser/Reader captures include every original author script.
              // This calculation loads the compiler's actual script view;
              // retain those same captured scopes without granting other realms.
              const scripts=new Set(schemaExecutionViewV4(source.program).scripts.map(script=>script.identity)),
                selected=scopeReadFrame.scripts.filter(script=>scripts.has(script.scriptId))
              if(selected.length!==scopeReadFrame.scripts.length) {
                const {frameSha256:_oldFrame,...frame}=scopeReadFrame
                scopeReadFrame=createMvuScopeReadFrameV1({...frame,scripts:selected})
              }
            }
            const input:MvuSchemaTrialInputV4={schemaVersion:4,encoding:'native-mvu-author-schema-phase-input-v4',
              errorPolicy:source.program?schemaPhaseErrorPolicyForProgramV4(source.program):'atomic-refusal',
              phase:'update-core',base:null,values:stat_data as MvuJsonObject,
              context,scopeReadFrame,clockEpochMs:Date.now(),randomSeed:request.trialId,
              update:{schemaVersion:1,encoding:'native-mvu-196-update-start-v1',updateId:request.trialId,
                message:request.message,interests:request.interests,...source.macros?{macros:source.macros}:{}}}
            const opened=await open.call(runtime.runner,source.program,input,controller.signal)
            if(opened.kind!=='opened-trial')return fail(opened.diagnostics[0]?.code??'AUTHOR_NATIVE_MVU_TRIAL_FAILED')
            trial.run=opened.run
            if(!current()||!source.current()||controller.signal.aborted)fail('AUTHOR_NATIVE_MVU_TRIAL_REVOKED')
            ready.resolve({kind:'output',output:opened.output})
          }catch(error) {
            ready.reject(error)
            // Release the same failed operation after its open promise settles.
            void close(trial).catch(()=>{})
          }finally {signal.removeEventListener('abort',abort)}
        })()
        return trial.pending
      }
      default:return fail('AUTHOR_NATIVE_MVU_TRIAL_REQUEST_INVALID')
    }
  }
  return {
    handle,
    releaseOwner(owner:object) {for(const trial of owners.get(owner)?.values()??[])void close(trial).catch(()=>{})},
    releaseSession(sid:string) {for(const trial of active)if(trial.sessionId===sid)void close(trial).catch(()=>{})},
    async dispose() {disposed=true;await Promise.all([...active].map(close))},
  }
}
