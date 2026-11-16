import {posix} from 'node:path'
import type {QuickJSHandle,QuickJSWASMModule} from 'quickjs-emscripten-core'
import type {CommunityProfileModuleInputV1,CommunityProfileEvaluatorV1} from './community-preset-profiles.js'
import {TEMPLATE_LIMITS_V1 as limits} from './tavern-template-data.mjs'

/** Configuration modules share the owned QuickJS actor, with an isolated realm
 * for each explicit import or control action. Only supplied module bytes load. */
export function evaluateCommunityProfileModuleV1(quickjs:QuickJSWASMModule,input:CommunityProfileModuleInputV1)
  :Awaited<ReturnType<CommunityProfileEvaluatorV1>> {
  const runtime=quickjs.newRuntime()
  runtime.setMemoryLimit(limits.vmMemoryBytes)
  runtime.setMaxStackSize(limits.vmStackBytes)
  const deadline=performance.now()+limits.vmDeadlineMs
  runtime.setInterruptHandler(()=>performance.now()>=deadline)
  runtime.setModuleLoader(name=>{
    const source=Object.hasOwn(input.modules,name)?input.modules[name]:undefined
    if(source===undefined)throw Error('COMMUNITY_PROFILE_IMPORT_UNAVAILABLE')
    return source
  },(base,name)=>name.startsWith('.')?posix.normalize(posix.join(posix.dirname(base),name)):name)
  const context=runtime.newContext()
  const checked=(result:{value?:QuickJSHandle;error?:QuickJSHandle}):QuickJSHandle=>{
    if(result.error){
      const error=context.dump(result.error)
      result.error.dispose()
      throw Error('COMMUNITY_PROFILE_MODULE_FAILED', {cause:error})
    }
    return result.value!
  }
  const settle=(handle:QuickJSHandle)=>{
    let jobs=0
    while(runtime.hasPendingJob()){
      if(++jobs>limits.promiseJobs)throw Error('COMMUNITY_PROFILE_MODULE_JOB_LIMIT')
      const job=runtime.executePendingJobs(1)
      if(job.error){job.dispose();throw Error('COMMUNITY_PROFILE_MODULE_FAILED')}
      job.dispose()
    }
    const state=context.getPromiseState(handle)
    if(state.type==='pending')throw Error('COMMUNITY_PROFILE_MODULE_UNSETTLED')
    if(state.type==='rejected'){
      const error=context.dump(state.error)
      state.error.dispose()
      throw Error('COMMUNITY_PROFILE_MODULE_FAILED',{cause:error})
    }
    if(!state.notAPromise)state.value.dispose()
  }
  try {
    const setup=checked(context.evalCode(`(() => {
      const OriginalDate=Date,clock=${JSON.stringify(input.clockEpochMs)};
      function FixedDate(...args) {
        if(!new.target)return new OriginalDate(clock).toString();
        return Reflect.construct(OriginalDate,args.length?args:[clock],new.target);
      }
      FixedDate.prototype=OriginalDate.prototype;
      Object.defineProperty(OriginalDate.prototype,'constructor',{value:FixedDate});
      FixedDate.parse=OriginalDate.parse;FixedDate.UTC=OriginalDate.UTC;
      FixedDate.now=()=>clock;
      globalThis.Date=FixedDate;
      let seed=2166136261;
      for(const char of ${JSON.stringify(input.randomSeed)})seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
      Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
    })();`,'profile-basis.js'))
    setup.dispose()
    const execution=checked(context.evalCode(`import configuration from ${JSON.stringify(input.entry)};
      const predicates=[];
      const answers=JSON.parse(${JSON.stringify(JSON.stringify(input.answers??null))});
      const materialize=answers===null;
      function data(value,key) {
        if(typeof value==='function') {
          if(key!=='when')throw Error('COMMUNITY_PROFILE_CONFIGURATION_INVALID');
          const index=predicates.push(value)-1;
          return materialize?{schemaVersion:1,kind:'module-predicate',index}:undefined;
        }
        if(Array.isArray(value)) {
          const result=materialize?new Array(value.length):undefined;
          value.forEach((item,index)=>{const resolved=data(item);if(result)result[index]=resolved;});
          return result;
        }
        if(value&&typeof value==='object') {
          const result=materialize?Object.create(null):undefined;
          for(const [name,item] of Object.entries(value)) {
            const resolved=data(item,name);
            if(result)result[name]=resolved;
          }
          return result;
        }
        return value;
      }
      const resolved=data(await configuration);
      const results=answers===null?[]:await Promise.all(predicates.map(async predicate=>{
        const result=await predicate(answers);
        if(typeof result!=='boolean')throw Error('COMMUNITY_PROFILE_PREDICATE_INVALID');
        return result;
      }));
      globalThis.__profileResult=JSON.stringify(materialize
        ?{configuration:resolved,predicates:results}:{predicates:results});
    `,'nexttavern-profile-evaluation.mjs',{type:'module'}))
    try {settle(execution)}finally{execution.dispose()}
    const result=context.getProp(context.global,'__profileResult')
    try {return JSON.parse(context.getString(result))}finally{result.dispose()}
  }finally{context.dispose();runtime.dispose()}
}
