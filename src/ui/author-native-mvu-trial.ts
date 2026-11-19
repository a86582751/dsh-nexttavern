import {AUTHOR_NATIVE_MVU_HOOK_EVENTS} from '../core/author-native-mvu-hook-types.js'
import type {AuthorNativeMvuHookGraphV1} from '../core/author-native-mvu-hook-graph.js'
import type {createAuthorNativeMvuHookGraph} from '../core/author-native-mvu-hook-graph.js'
import type {Mvu196HookStage} from '../core/tavern-mvu-update-protocol-v1.js'
import type {MvuJsonObject} from '../core/tavern-mvu-initvar.js'

/** Serialized into each author realm. Each invocation retains its own graph,
 * including objects detached by an earlier callback in this same event. */
export function createAuthorNativeMvuTrialEvents(
  createGraph:typeof createAuthorNativeMvuHookGraph,
  listeners:()=>readonly {readonly event:string}[],
  dispatch:(event:string,args:readonly unknown[])=>Promise<unknown>,
  hookEvents:typeof AUTHOR_NATIVE_MVU_HOOK_EVENTS=AUTHOR_NATIVE_MVU_HOOK_EVENTS,
) {
  const stages=Object.keys(hookEvents).filter(stage=>stage!=='initialized'&&stage!=='before-message-update') as Mvu196HookStage[]
  return {
    interests:():readonly Mvu196HookStage[]=>{
      const registered=new Set(listeners().map(row=>row.event))
      return stages.filter(stage=>registered.has(hookEvents[stage]))
    },
    async invoke(stage:Mvu196HookStage,wire:AuthorNativeMvuHookGraphV1):Promise<AuthorNativeMvuHookGraphV1> {
      const graph=createGraph(),roots=graph.materialize(wire),args=roots[2] as readonly unknown[]
      await dispatch(hookEvents[stage],args)
      return graph.capture(roots)
    },
  }
}

export interface AuthorNativeMvuTrialHooksV1 {
  readonly interests:readonly Mvu196HookStage[]
  invoke(stage:Mvu196HookStage,graph:AuthorNativeMvuHookGraphV1):Promise<AuthorNativeMvuHookGraphV1>
}
export type AuthorNativeMvuTrialOutputV1=import('../core/roleplay-author-mvu-trial.js').AuthorMvuTrialOutputV1
export interface AuthorNativeMvuTrialTransportV1 {
  begin(input:{readonly trialId:string;readonly message:string;readonly oldData:MvuJsonObject;
    readonly interests:readonly Mvu196HookStage[]}):Promise<AuthorNativeMvuTrialOutputV1>
  advance(trialId:string,input:{readonly updateId:string;readonly yieldOrdinal:number;
    readonly graph:AuthorNativeMvuHookGraphV1;readonly interests:readonly Mvu196HookStage[]}):Promise<AuthorNativeMvuTrialOutputV1>
  close(trialId:string):Promise<void>
  current():boolean
}

/** The live computation belongs to Core. UI delivers only the captured mutable
 * events and releases that same handle, including after a failed callback. */
export async function runAuthorNativeMvuTrial(input:{readonly trialId:string;readonly message:string;
  readonly oldData:MvuJsonObject;readonly hooks:AuthorNativeMvuTrialHooksV1;
  readonly transport:AuthorNativeMvuTrialTransportV1;readonly signal:AbortSignal}):Promise<MvuJsonObject> {
  const {transport,hooks,signal,trialId}=input
  const check=()=>{
    signal.throwIfAborted()
    if(!transport.current())throw Error('AUTHOR_NATIVE_MVU_TRIAL_REVOKED')
  }
  try {
    check()
    let output=await transport.begin({trialId,message:input.message,oldData:input.oldData,interests:hooks.interests})
    for(;;) {
      check()
      if(output.kind!=='accepted')throw Error(output.diagnostics[0]?.code??'AUTHOR_NATIVE_MVU_TRIAL_FAILED')
      const update=output.update
      if(update?.kind==='complete')return {...output.context,stat_data:output.values}
      if(update?.kind!=='yield')throw Error('AUTHOR_NATIVE_MVU_TRIAL_OUTPUT_INVALID')
      const graph=await hooks.invoke(update.stage,update.graph)
      check()
      output=await transport.advance(trialId,{updateId:update.updateId,yieldOrdinal:update.yieldOrdinal,
        graph,interests:hooks.interests})
    }
  }finally {
    // Release uses the original handle even when its browser binding expired.
    // It grants no further computation or callback after revocation.
    await transport.close(trialId)
  }
}
