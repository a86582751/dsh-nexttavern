import {Worker} from 'node:worker_threads'
import {PROMPT_BOUNDS_V1 as bounds} from './tavern-author-prompt-profile.mjs'
import {createAuthorPromptCompilerV1} from './tavern-author-prompt-compiler.mjs'
import {validatePromptProgramV1} from './tavern-author-prompt-data.mjs'
import type {PromptCaptureV1,PromptProgramV1,PromptWorkerRequestV1,
  PromptCandidateBatchV1,PromptExecutionV1,OwnedAuthorPromptRuntimeV1,PromptCompilerIdentityV1,
  PromptRuntimeIdentityV1} from './tavern-author-prompt-types.mjs'

/** One worker per compilation/preparation. Resolution waits for termination,
 * so a timed-out/cancelled realm cannot outlive the returned result. */
async function dispatchPromptWorkerV1(workerURL:URL,request:PromptWorkerRequestV1,signal?:AbortSignal):
  Promise<PromptCandidateBatchV1|PromptExecutionV1> {
  if(signal?.aborted)return {kind:'cancelled',diagnostics:[{code:'PROMPT_CANCELLED'}]}
  const worker=new Worker(workerURL,{
    workerData:request,resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:32,stackSizeMb:4},
  })
  let timer:ReturnType<typeof setTimeout>|undefined,abort:(()=>void)|undefined
  try {
    return await new Promise<PromptCandidateBatchV1|PromptExecutionV1>((resolve)=>{
      let settled=false
      const finish=(result:PromptCandidateBatchV1|PromptExecutionV1):void=>{
        if(settled)return;settled=true
        clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort)
        void worker.terminate().then(()=>resolve(result),()=>resolve({kind:'refused',diagnostics:[{code:'PROMPT_TERMINATION_FAILED'}]}))
      }
      abort=()=>finish({kind:'cancelled',diagnostics:[{code:'PROMPT_CANCELLED'}]})
      signal?.addEventListener('abort',abort,{once:true})
      timer=setTimeout(()=>finish({kind:'refused',diagnostics:[{code:'PROMPT_WORKER_TIMEOUT'}]}),bounds.parentDeadlineMs)
      worker.once('message',finish)
      worker.once('error',()=>finish({kind:'refused',diagnostics:[{code:'PROMPT_WORKER_FAILED'}]}))
      worker.once('exit',()=>finish({kind:'refused',diagnostics:[{code:'PROMPT_WORKER_EXIT'}]}))
      if(signal?.aborted)abort()
    })
  } finally {clearTimeout(timer);if(abort)signal?.removeEventListener('abort',abort)}
}
/** Caller supplies the captured Source/Native view. Reusing this returned DATA
 * for provider retries belongs to the caller's existing prepared-plan owner. */
export async function runAuthorPromptProgramV1(program:PromptProgramV1,capture:PromptCaptureV1,
  dependencies:{readonly signal?:AbortSignal;dispatch(request:PromptWorkerRequestV1,signal?:AbortSignal):
    Promise<PromptCandidateBatchV1|PromptExecutionV1>}):Promise<PromptExecutionV1> {
  try {
    const decoded=validatePromptProgramV1(program)
    const result=await dependencies.dispatch({kind:'execute',program:decoded,capture},dependencies.signal)
    return 'rows' in result?{kind:'refused',diagnostics:[{code:'PROMPT_WORKER_RESPONSE'}]}:result
  } catch(error) {return {kind:'refused',diagnostics:[{code:error instanceof Error
    &&error.message==='PROMPT_PROGRAM_DATA_INVALID'?error.message:'PROMPT_WORKER_FAILED'}]}}
}
/** The protected provider fixes the binding once. This owner alone dispatches
 * and revokes all its compilation and execution workers. */
export function createAuthorPromptExecutionOwnerV1(binding:{compiler:PromptCompilerIdentityV1;
  runtime:PromptRuntimeIdentityV1;worker:URL}):OwnedAuthorPromptRuntimeV1 {
  let disposed=false,disposal:Promise<void>|undefined
  const running=new Map<AbortController,Promise<PromptCandidateBatchV1|PromptExecutionV1>>()
  const admittedPrograms=new Set<string>()
  const checkCurrent=()=>{if(disposed)throw Error('PROMPT_RUNTIME_DISPOSED')}
  const dispatch=(request:PromptWorkerRequestV1,signal?:AbortSignal):Promise<PromptCandidateBatchV1|PromptExecutionV1>=>{
    checkCurrent()
    const controller=new AbortController(),abort=()=>controller.abort()
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()
    const result=dispatchPromptWorkerV1(binding.worker,request,controller.signal)
      .finally(()=>{signal?.removeEventListener('abort',abort);running.delete(controller)})
    running.set(controller,result);return result
  }
  const compiler=createAuthorPromptCompilerV1({...binding,dispatch,accept:program=>admittedPrograms.add(program.programSha256)})
  return Object.freeze({compiler,runtime:binding.runtime,checkCurrent,
    async execute(program:PromptProgramV1,capture:PromptCaptureV1,signal?:AbortSignal):Promise<PromptExecutionV1> {
      checkCurrent()
      if(!admittedPrograms.has(program.programSha256))return {kind:'refused',diagnostics:[{code:'PROMPT_PROGRAM_NOT_COMPILED'}]}
      const result=await runAuthorPromptProgramV1(program,capture,{dispatch,signal})
      checkCurrent();return result
    },dispose():Promise<void> {
      if(disposal)return disposal
      disposed=true;for(const controller of running.keys())controller.abort()
      return disposal=Promise.allSettled([...running.values()]).then(()=>{admittedPrograms.clear()})
    }})
}
