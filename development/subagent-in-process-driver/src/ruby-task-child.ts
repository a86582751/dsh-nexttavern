/** One fresh Ruby child uses the ordinary Native inbox and request planner.
 * Core supplies live task ownership; this module owns only child composition. */
import {createHash} from 'node:crypto'
import type {Context} from '@deepseek-ai/cordis'
import {brandString} from '@deepseek-ai/dsh-brand'
import {freezeMessage,type MessageId,type UserMessage} from '@deepseek-ai/dsh-llm'
import {nativeInputSha256} from '@deepseek-ai/dsh-agent-loop'
import type {NativeInputAdmissionAgentV2,NativeInputAdmissionHookV2,NativeInputAdmissionCheckV2,
  NativeRequestMaterialOwnerV1,NativeOwnedMaterialAnchoredInsertionV1}
  from '@deepseek-ai/dsh-agent-loop'
import type {OwnedRubyTaskActivationV1,OwnedRubyTaskOwnerV1} from '@deepseek-ai/dsh-subagent'

const prefixName='deployment:persona-prefix'
const textSha256=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex')
const blocked=(code:string)=>({kind:'blocked' as const,code})

export interface OwnedRubyTaskChildV1 {
  readonly userMessage:UserMessage
}

/** Called in factory setup with the actual AgentLoop capability. The caller's
 * ordinary composition has already restricted tools to the empty set. */
export function composeOwnedRubyTaskActivationV1(ctx:Context,child:NativeInputAdmissionAgentV2,
  activation:OwnedRubyTaskActivationV1,owner:OwnedRubyTaskOwnerV1):OwnedRubyTaskChildV1 {
  const first=activation.orderedMessages[0]!,leadingSystem=first.role==='system'?first:undefined,
    userOrdinal=activation.mainInputMessageIndex??activation.orderedMessages.findIndex(message=>message.role==='user'),
    originalUser=activation.orderedMessages[userOrdinal]!
  const userMessage:UserMessage=freezeMessage({id:brandString<MessageId>(activation.userMessageId),
    role:'user',source:{kind:'user'},content:[{type:'text',text:originalUser!.text}]})
  const identity=Object.freeze({rubyTask:activation.taskId,generation:activation.generation})
  const preparation=Object.freeze({...owner.preparation}),snapshot=Object.freeze({...owner.snapshot}),
    plan=Object.freeze({...owner.plan}),captureSha256=owner.captureSha256
  const assertOwnerCurrent=owner.assertCurrent.bind(owner),checkpoint=owner.checkpoint.bind(owner),
    completedWork=owner.completedWork.bind(owner),stop=owner.onStop.bind(owner),onBlocked=owner.onBlocked?.bind(owner)
  let active=true,admitted=false
  let prepared:{turn:number;step:number;sectionSha256?:string}|undefined
  const checkAdmission=(input:NativeInputAdmissionCheckV2)=>{
    if(!active)return blocked('RUBY_TASK_REVOKED')
    try{assertOwnerCurrent()}catch{return blocked('RUBY_TASK_REVOKED')}
    if(input.identity!==identity)return blocked('RUBY_INPUT_OWNER_CHANGED')
    return {kind:'allow' as const}
  }
  const inserts=activation.orderedMessages.flatMap((message,ordinal)=>
    (leadingSystem&&ordinal===0)||ordinal===userOrdinal?[]:[{ordinal,
      side:ordinal<userOrdinal?'before' as const:'after' as const,
      role:message.role,text:message.text,textSha256:textSha256(message.text)}])
  const material:NativeRequestMaterialOwnerV1={
    // Native requires a nonempty declared namespace even when this request has
    // no leading system section. No empty section is registered to fill it.
    schemaVersion:1,sectionNames:[prefixName],
    async prepare(input){
      // A second Native step after a tool-producing response must not spend
      // another request. The same prepared result remains valid for step 1.
      if(prepared)return prepared.turn===input.turn&&prepared.step===input.step
        ?{kind:'prepared'}:blocked('RUBY_REQUEST_BUDGET_EXHAUSTED')
      const checked=checkAdmission(input.admission)
      if(checked.kind==='blocked')return checked
      const selected=input.selected.messages
      if(selected.length!==1||selected[0]!.role!=='user'||selected[0]!.id!==activation.userMessageId)
        return blocked('RUBY_SELECTED_INPUT_CHANGED')
      // Inherited plugin sections/contexts would change the configured ordered
      // request. This one real assembly boundary establishes compatibility;
      // Native subsequently preserves and checks its frozen preparation.
      const assembly=input.finalAssembly
      if(assembly.sections.length!==(leadingSystem?1:0)
        ||leadingSystem&&assembly.sections[0]!.name!==prefixName
        ||assembly.contexts.length!==0||assembly.tools.length!==0)return blocked('RUBY_ASSEMBLY_CHANGED')
      prepared={turn:input.turn,step:input.step,
        ...(leadingSystem?{sectionSha256:nativeInputSha256(assembly.sections[0])}:{})}
      return {kind:'prepared'}
    },
    transform(input){
      // Native calls transform for every provider retry; preparation runs once.
      if(!input.firstAttempt)return blocked('RUBY_REQUEST_BUDGET_EXHAUSTED')
      const checked=checkAdmission(input.admission)
      if(checked.kind==='blocked')return checked
      const selectedUser=input.selected.messages[0]!
      const anchoredInsertions:NativeOwnedMaterialAnchoredInsertionV1[]=inserts.map(message=>({
        contributionRef:`ruby:${activation.taskId}:${message.ordinal}`,
        sourceSha256:message.textSha256,renderedText:message.text,renderedSha256:message.textSha256,
        requestedRole:message.role,stableOrder:message.ordinal,
        anchor:{schemaVersion:1,encoding:'native-selected-message-anchor-v1',side:message.side,
          target:{id:selectedUser.id,role:'user',messageSha256:selectedUser.messageSha256}},
      }))
      return {kind:'transform',schemaVersion:1,encoding:'native-request-material-owner-transform-v1',
        snapshot,plan,captureSha256,expectedAssemblySha256:input.assemblySha256,
        expectedSelectedBaseSha256:input.selected.sha256,
        requiredSections:leadingSystem?[{name:prefixName,sha256:prepared!.sectionSha256!}]:[],
        sections:[],insertions:[],anchoredInsertions}
    },
    check(input){return checkAdmission(input.admission)},
  }
  const hook:NativeInputAdmissionHookV2={
    schemaVersion:2,requestMaterial:material,
    async admit(proposal,signal,existing){
      signal.throwIfAborted()
      if(!active)return blocked('RUBY_TASK_REVOKED')
      try{assertOwnerCurrent()}catch{return blocked('RUBY_TASK_REVOKED')}
      if(existing||admitted||proposal.messages.length!==1)return blocked('RUBY_INPUT_PLAN_CHANGED')
      const message=proposal.messages[0]!
      if(message.id!==activation.userMessageId||message.role!=='user'||message.content.length!==1
        ||message.content[0]!.type!=='text'||message.content[0]!.text!==originalUser!.text)
        return blocked('RUBY_INPUT_PLAN_CHANGED')
      admitted=true
      return {kind:'allow',identity,preparation,completedWorkRequired:true}
    },
    check:checkAdmission,checkpoint,completedWork,
    onStop(notice){active=false;return stop(notice)},
    ...(onBlocked?{onBlocked}:{}),
  }
  const cleanup:(()=>void)[]=[]
  let disposed=false
  const dispose=()=>{
    if(disposed)return
    disposed=true;active=false
    for(const remove of cleanup.reverse())remove()
  }
  try{
    if(leadingSystem)cleanup.push(ctx.systemPrompt.section({name:prefixName,
      order:ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
      text:leadingSystem.text,interpolate:false,complete:true}))
    else cleanup.push(ctx.on('system-prompt/assemble',async(_assembly,_context,next)=>({
      ...await next(),sections:[],
    })))
    cleanup.push(ctx.systemPrompt.suppressRuntimeContext())
    cleanup.push(child.registerInputAdmission(hook))
    ctx.effect(()=>dispose)
    return {userMessage}
  }catch(error){dispose();throw error}
}
