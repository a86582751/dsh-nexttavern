/** Trusted Node worker owns QuickJS. Author code receives only JSON copies and
 * effect functions; no Node handles, timers, network or live state enter it. */
import {parentPort,workerData} from 'node:worker_threads'
import {newQuickJSWASMModuleFromVariant} from 'quickjs-emscripten-core'
import variant from '@jitl/quickjs-wasmfile-release-sync'
import type {QuickJSContext,QuickJSHandle} from 'quickjs-emscripten-core'
import {recordSha256} from './roleplay-data.js'
import {compilePromptCandidatesInWorkerV1} from './tavern-author-prompt-compiler.mjs'
import {PROMPT_BOUNDS_V1 as bounds,PROMPT_PROFILE_SHA256_V1} from './tavern-author-prompt-profile.mjs'
import type {PromptWorkerRequestV1,PromptExecutionV1,PromptEffectV1,
  PromptExecutionOutputV1} from './tavern-author-prompt-types.mjs'

const BOOTSTRAP=String.raw`((captureWire)=>{
  'use strict';
  const parse=JSON.parse,stringify=JSON.stringify,freeze=Object.freeze,keys=Object.keys;
  const apply=Reflect.apply,push=Array.prototype.push,slice=Array.prototype.slice;
  const originalDate=Date,construct=Reflect.construct,imul=Math.imul;
  const capture=parse(captureWire),effects=[],cleanups=[],callbacks=[];
  let origin,cleanup=false,closed=false,unsupported=null,seed=2166136261;
  const fail=code=>{throw code;};
  function frozen(value){if(value&&typeof value==='object'){for(const key of keys(value))frozen(value[key]);freeze(value);}return value;}
  frozen(capture);
  for(let i=0;i<capture.randomSeed.length;i++)seed=imul(seed^capture.randomSeed.charCodeAt(i),16777619)>>>0;
  function FixedDate(...args){const date=construct(originalDate,args.length?args:[capture.clockEpochMs]);return new.target?date:date.toString();}
  FixedDate.prototype=originalDate.prototype;
  Object.defineProperty(FixedDate.prototype,'constructor',{value:FixedDate,writable:false,configurable:false});
  FixedDate.now=()=>capture.clockEpochMs;FixedDate.parse=originalDate.parse;FixedDate.UTC=originalDate.UTC;
  Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
  Object.defineProperty(globalThis,'Date',{value:FixedDate,writable:false,configurable:false});
  function fieldset(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)
    ||keys(value).some(key=>!allowed.includes(key)))fail('PROMPT_API_REQUEST_UNSUPPORTED');}
  function index(value){if(!Number.isSafeInteger(value))fail('PROMPT_MESSAGE_RANGE_UNSUPPORTED');return value<0?capture.messages.length+value:value;}
  function getChatMessages(range,option={}){
    fieldset(option,['include_swipes','role','hide_state']);
    if(option.include_swipes!==undefined&&typeof option.include_swipes!=='boolean'
      ||option.role!==undefined&&!['all','user','assistant'].includes(option.role)
      ||option.hide_state!==undefined&&option.hide_state!=='all')fail('PROMPT_MESSAGE_OPTION_UNSUPPORTED');
    if(typeof range!=='number'&&typeof range!=='string')fail('PROMPT_MESSAGE_RANGE_UNSUPPORTED');
    const rangeText=String(range).replace(/{{lastMessageId}}/gi,String(capture.messages.length-1));
    const match=/^(-?\d+)(?:-(-?\d+))?$/.exec(rangeText);
    if(!match||!capture.messages.length)return frozen([]);
    const clamp=value=>Math.max(0,Math.min(capture.messages.length-1,value<0?capture.messages.length+value:value));
    const first=clamp(Number(match[1])),last=match[2]===undefined?first:clamp(Number(match[2]));
    const start=Math.min(first,last),end=Math.max(first,last);
    const result=[];
    for(let i=start;i<=end;i++){
      const row=capture.messages[i];if(option.role&&option.role!=='all'&&row.role!==option.role)continue;
      if(option.include_swipes&&!row.variants){unsupported='PROMPT_SWIPES_UNSUPPORTED';fail(unsupported);}
      const item={message_id:row.index,role:row.role,message:row.message};
      if(option.include_swipes){item.swipes=apply(slice,row.variants.swipes,[]);item.swipe_id=row.variants.swipe_id;}
      apply(push,result,[frozen(item)]);
    }return frozen(result);
  }
  function getVariables(option){
    if(option===undefined)option={type:'chat'};
    if(option&&option.type==='message'){
      fieldset(option,['type','message_id']);
      const selected=option.message_id===undefined||option.message_id==='latest'?capture.messages.length-1:index(option.message_id);
      if(selected<0||selected>=capture.messages.length)fail('SCOPE_READ_MESSAGE_INDEX_OUT_OF_RANGE');
      const variables=capture.messages[selected].variables;
      if(variables.kind==='unavailable')fail(variables.code);return variables.variables;
    }
    // Core already supplied the Source-owned readonly frame. Project its
    // tables directly in the guest instead of decoding it for every script.
    fieldset(option,['type','script_id']);
    if(option.type===undefined){fieldset(option,['type']);return undefined;}
    let variables;
    if(['chat','character','global'].includes(option.type)){
      fieldset(option,['type']);variables=capture.scopeFrame.scopes[option.type];
    }else if(option.type==='script'){
      if(option.script_id!==undefined&&option.script_id!==origin.scriptIdentity)fail('SCOPE_READ_REQUEST_INVALID');
      const script=capture.scopeFrame.scripts.find(row=>row.scriptId===origin.scriptIdentity);
      if(!script)fail('SCOPE_READ_SCRIPT_UNAVAILABLE');variables=script.variables;
    }else fail('SCOPE_READ_REQUEST_INVALID');
    if(variables.kind==='unavailable')fail(variables.code);
    if(option.type==='chat'&&capture.authorChat&&capture.authorChat.exists)
      return frozen({...variables.variables,[capture.authorChat.binding.key]:capture.authorChat.value});
    return variables.variables;
  }
  function ids(value){if(!Array.isArray(value)||value.length>256)fail('PROMPT_REMOVAL_UNSUPPORTED');
    for(let i=0;i<value.length;i++)if(typeof value[i]!=='string'||!value[i])fail('PROMPT_REMOVAL_UNSUPPORTED');
    return apply(slice,value,[]);}
  function add(effect){if(effects.length>=256)fail('PROMPT_EFFECT_LIMIT');apply(push,effects,[{...origin,...effect}]);}
  function uninjectPrompts(value){const list=ids(value);if(cleanup)apply(push,cleanups,[{...origin,ids:list}]);else add({kind:'remove',ids:list});}
  function injectPrompts(prompts,option={}){
    if(cleanup)fail('PROMPT_CLEANUP_STATEFUL_UNSUPPORTED');fieldset(option,['once']);
    if(option.once!==undefined&&typeof option.once!=='boolean'||!Array.isArray(prompts)||prompts.length>256)fail('PROMPT_INJECTION_UNSUPPORTED');
    const copied=[];
    for(const p of prompts){fieldset(p,['id','position','depth','role','content','should_scan']);
      if(typeof p.id!=='string'||!p.id||!['none','in_chat'].includes(p.position)||!Number.isSafeInteger(p.depth)||p.depth<0
        ||!['system','user','assistant'].includes(p.role)||typeof p.content!=='string'||typeof p.should_scan!=='boolean')fail('PROMPT_INJECTION_UNSUPPORTED');
      apply(push,copied,[{id:p.id,position:p.position,depth:p.depth,role:p.role,content:p.content,should_scan:p.should_scan}]);}
    add({kind:'inject',prompts:copied,once:option.once===true});
  }
  function eventOn(event,callback){if(closed||event!=='GENERATION_AFTER_COMMANDS'||typeof callback!=='function'||callbacks.length>=256)
    fail('PROMPT_REGISTRATION_UNSUPPORTED');apply(push,callbacks,[{origin:{...origin},callback}]);}
  const window=freeze({addEventListener(event,callback){if(closed||event!=='pagehide'||typeof callback!=='function')fail('PROMPT_LIFECYCLE_UNSUPPORTED');
    // Complete AST admission proves this body only declares fixed removals.
    // Collect those declarations now; this is never a Source-close event.
    cleanup=true;try{callback();}finally{cleanup=false;}}});
  for(const [name,value] of Object.entries({eventOn,getChatMessages,getVariables,injectPrompts,uninjectPrompts,window,
    tavern_events:freeze({GENERATION_AFTER_COMMANDS:'GENERATION_AFTER_COMMANDS'})}))
    Object.defineProperty(globalThis,name,{value,writable:false,configurable:false});
  return freeze({select(wire){origin=frozen(parse(wire));},endScript(){
    if(!callbacks.some(entry=>entry.origin.originalOrdinal===origin.originalOrdinal))fail('PROMPT_GENERATION_REGISTRATION_MISSING');
  },finish(){closed=true;
    for(const entry of callbacks){
      origin=entry.origin;const result=entry.callback();
      if(result&&typeof result.then==='function')fail('PROMPT_ASYNC_UNSUPPORTED');
    }
    if(unsupported)fail(unsupported);const output=stringify({effects,cleanupRemovals:cleanups,callbacksExecuted:callbacks.length});
    if(output.length>2097152)fail('PROMPT_OUTPUT_LIMIT');return output;}});
})`
class Refusal extends Error {constructor(readonly code:string){super(code)}}
function checked(context:QuickJSContext,result:{value?:QuickJSHandle;error?:QuickJSHandle}):QuickJSHandle {
  if(result.error) {
    let code='PROMPT_GUEST_FAILED'
    try {if(context.typeof(result.error)==='string') {
      const length=context.getProp(result.error,'length')
      try {if(context.getNumber(length)<=256) {
        const text=context.getString(result.error);if(/^(PROMPT_|SCOPE_|MESSAGE_)[A-Z_]{1,100}$/.test(text))code=text
      }}finally{length.dispose()}
    }} finally {result.error.dispose()}
    throw new Refusal(code)
  }
  return result.value!
}
async function execute(request:Extract<PromptWorkerRequestV1,{kind:'execute'}>):Promise<PromptExecutionV1> {
  const {program,capture}=request
  if(program.profileSha256!==PROMPT_PROFILE_SHA256_V1)throw new Refusal('PROMPT_PROFILE_UNSUPPORTED')
  const module=await newQuickJSWASMModuleFromVariant(variant),runtime=module.newRuntime()
  runtime.setMemoryLimit(bounds.memoryBytes);runtime.setMaxStackSize(bounds.stackBytes)
  const deadline=Date.now()+bounds.vmDeadlineMs
  runtime.setInterruptHandler(()=>Date.now()>=deadline)
  const context=runtime.newContext(),owned:QuickJSHandle[]=[]
  try {
    const captureWire=context.newString(JSON.stringify(capture));owned.push(captureWire)
    const bootstrap=checked(context,context.evalCode(BOOTSTRAP,'owned-prompt-bootstrap.js'));owned.push(bootstrap)
    const controller=checked(context,context.callFunction(bootstrap,context.undefined,captureWire));owned.push(controller)
    for(const script of program.scripts) {
      if(!script.descriptor.enabled)continue
      const select=context.getProp(controller,'select'),wire=context.newString(JSON.stringify({originalOrdinal:script.ordinal,
        scriptIdentity:script.descriptor.identity,descriptorSha256:script.descriptorSha256}))
      try {checked(context,context.callFunction(select,controller,wire)).dispose()}
      finally {select.dispose();wire.dispose()}
      checked(context,context.evalCode(`(function(){'use strict';\n${script.javascript}\n})();`,'owned-author-prompt.js')).dispose()
      const end=context.getProp(controller,'endScript')
      try {checked(context,context.callFunction(end,controller)).dispose()}finally{end.dispose()}
    }
    const finish=context.getProp(controller,'finish')
    let text:string
    try {const value=checked(context,context.callFunction(finish,controller));try{text=context.getString(value)}finally{value.dispose()}}
    finally {finish.dispose()}
    if(Buffer.byteLength(text,'utf8')>bounds.outputBytes)throw new Refusal('PROMPT_OUTPUT_LIMIT')
    const result=JSON.parse(text) as {effects:PromptEffectV1[];cleanupRemovals:PromptExecutionOutputV1['cleanupRemovals'];callbacksExecuted:number}
    const data={schemaVersion:1 as const,encoding:'native-author-prompt-execution-output-v1' as const,
      authority:'consumer-data-only' as const,programSha256:program.programSha256,captureSha256:capture.captureSha256,...result}
    return {kind:'executed',output:{...data,outputSha256:recordSha256(data)}}
  } finally {for(const handle of owned.reverse())handle.dispose();context.dispose();runtime.dispose()}
}
try {
  const request=workerData as PromptWorkerRequestV1
  parentPort?.postMessage(request.kind==='compile'?compilePromptCandidatesInWorkerV1(request.input,request.compiler,request.runtime):await execute(request))
} catch(error) {parentPort?.postMessage({kind:'refused',diagnostics:[{code:error instanceof Refusal?error.code:'PROMPT_WORKER_FAILED'}]})}
