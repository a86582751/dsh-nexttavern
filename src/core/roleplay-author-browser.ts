/** Core owns attachment lifetime; the existing Native player owns every write.
 * Retained compiled DATA never reconstructs an attachment after Core disposal. */
import {randomUUID} from 'node:crypto'
import {jsonResponse} from './roleplay-state.js'
import type {BrowserBindingV1,BrowserProgramV1,BrowserRuntimeArtifactV1,
  BrowserSnapshotV1} from './tavern-author-browser-types.mjs'
import type {MvuPlayerEditResponse} from './roleplay-mvu-player-types.js'
import type {AuthorBrowserRequest,AuthorBrowserReply,AuthorBrowserSnapshot,
  AuthorBrowserWriteProgram} from './roleplay-author-browser-types.js'
import type {BrowserProgramV2,BrowserRuntimeArtifactV2,BrowserSnapshotV2} from './tavern-author-browser-types-v2.mjs'
import type {AuthorScriptResourceReaderV1} from './roleplay-author-script-resources.js'
import type {BrowserProgramV3,BrowserRuntimeArtifactV3,BrowserSnapshotV3,
  BrowserOrdinaryKeyRequestV3,BrowserOrdinaryKeyReplyV3} from './tavern-author-browser-types-v3.mjs'

export interface AuthorBrowserCapturedFactsV1 {
  readonly program:BrowserProgramV1
  readonly artifact:BrowserRuntimeArtifactV1
  readonly data:Omit<BrowserSnapshotV1,'generation'|'readRevision'>
  current():boolean
}
export interface AuthorBrowserCapturedFactsV2 extends Omit<AuthorBrowserCapturedFactsV1,'program'|'artifact'|'data'> {
  readonly program:BrowserProgramV2
  readonly artifact:BrowserRuntimeArtifactV2
  readonly data:Omit<BrowserSnapshotV2,'generation'|'readRevision'>
  readonly resources?:AuthorScriptResourceReaderV1
}
export interface AuthorBrowserCapturedFactsV3 extends Omit<AuthorBrowserCapturedFactsV2,'program'|'artifact'|'data'> {
  readonly program:BrowserProgramV3
  readonly artifact:BrowserRuntimeArtifactV3
  readonly data:Omit<BrowserSnapshotV3,'generation'|'readRevision'>
  /** Actual Source read excludes its canonical State2 outputs. The separate
   * current() covers this captured DATA, including declared chat head values.
   * Source identity/edits/lifecycle remain watched across an ordinary commit. */
  sourceCurrent():boolean
}
export type AuthorBrowserCapturedFacts=AuthorBrowserCapturedFactsV1|AuthorBrowserCapturedFactsV2|AuthorBrowserCapturedFactsV3
interface Dependencies {
  ctx:{effect(work:()=>unknown,label?:string):unknown;connection:{fetch:{register(route:unknown):unknown}}}
  resolveSession(id:unknown):Promise<{id:string}|null|undefined>
  /** Captures the actual Session, Agent, catalog selection and Stop generation. */
  captureOwner(sid:string):(()=>boolean)|undefined
  captureFacts(sid:string):Promise<AuthorBrowserCapturedFacts|undefined>
  submit(input:unknown,current:()=>boolean):Promise<MvuPlayerEditResponse>
  confirm(input:unknown):Promise<MvuPlayerEditResponse>
  /** The retained attachment supplies its admitted program and actual Source
   * lifetime. Production Core must connect the canonical key Core here. */
  mutateAuthorKey?(sid:string,program:BrowserProgramV3,request:BrowserOrdinaryKeyRequestV3,
    sourceCurrent:()=>boolean,signal:AbortSignal):Promise<BrowserOrdinaryKeyReplyV3>
}
interface Attachment {
  readonly binding:BrowserBindingV1
  readonly program:BrowserProgramV1|BrowserProgramV2|BrowserProgramV3
  readonly artifact:BrowserRuntimeArtifactV1|BrowserRuntimeArtifactV2|BrowserRuntimeArtifactV3
  resources?:AuthorScriptResourceReaderV1
  /** The original Native lifecycle can never be replaced by a fresh capture. */
  readonly ownerCurrent:()=>boolean
  facts:AuthorBrowserCapturedFacts
  current():boolean
  readRevision:number
}
/** A page executes as its captured carrier. Only that carrier's admitted mount
 * joins page requirements to these Native writers; unrelated pages grant none. */
function scriptCapability(program:AuthorBrowserWriteProgram,identity:string,
  capability:'owned-native-personas'|'owned-named-worldbooks'|'owned-script-source-resources'):boolean {
  if(program.schemaVersion===2)return program.scripts.some(script=>
    script.descriptor.identity===identity&&script.requiredCapabilities.includes(capability))
  const script=program.scripts.find(row=>row.descriptor.identity===identity)
  if(!script)return false
  if(script.requiredCapabilities.includes(capability))return true
  return program.sourcePages.some(page=>
    page.origin.carrier.identity===identity&&script.sourcePagePlans.includes(page.pagePlanSha256)
    &&page.requiredCapabilities.includes(capability))
}
const sameBinding=(left:BrowserBindingV1,right:BrowserBindingV1)=>
  left.browserSessionId===right.browserSessionId&&left.generation===right.generation
  &&left.sessionId===right.sessionId&&left.programSha256===right.programSha256
const codeOf=(error:unknown)=>error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
  ?error.message:'BROWSER_ATTACHMENT_UNAVAILABLE'

export function createRoleplayAuthorBrowser(deps:Dependencies) {
  const attachments=new Map<string,Attachment>()
  const actionQueues=new Map<string,Promise<void>>()
  let disposed=false
  const fail=(code:string):never=>{throw Error(code)}
  const revoke=(value:Attachment)=>{
    attachments.delete(value.binding.browserSessionId)
  }
  function retained(binding:BrowserBindingV1):Attachment {
    const value=attachments.get(binding.browserSessionId)
    if(!value||!sameBinding(value.binding,binding))return fail('BROWSER_ATTACHMENT_REVOKED')
    if(!value.current()) {
      revoke(value)
      return fail('BROWSER_ATTACHMENT_REVOKED')
    }
    return value
  }
  function project(value:Attachment,facts:AuthorBrowserCapturedFacts):AuthorBrowserSnapshot {
    if(!value.current()||!facts.current()||facts.program.programSha256!==value.program.programSha256) {
      return fail('BROWSER_ATTACHMENT_REVOKED')
    }
    return {...facts.data,generation:value.binding.generation,readRevision:++value.readRevision}
  }
  async function snapshot(value:Attachment):Promise<AuthorBrowserSnapshot> {
    const facts=await deps.captureFacts(value.binding.sessionId)
    if(!facts)return fail('BROWSER_PROGRAM_UNAVAILABLE')
    return project(value,facts)
  }
  async function adoptCommittedFacts(value:Attachment,sourceCurrent?:()=>boolean):Promise<BrowserSnapshotV2|BrowserSnapshotV3|undefined> {
    if(!value.ownerCurrent()||sourceCurrent&&!sourceCurrent())return undefined
    const facts=await deps.captureFacts(value.binding.sessionId)
    if(disposed||attachments.get(value.binding.browserSessionId)!==value||!value.ownerCurrent()
      ||sourceCurrent&&!sourceCurrent()||!facts||facts.program.schemaVersion===1
      ||facts.program.schemaVersion!==value.program.schemaVersion
      ||facts.data.schemaVersion!==value.program.schemaVersion||!facts.current()
      ||facts.program.programSha256!==value.program.programSha256)return undefined
    // Only the actual successful writer calls this path. External changes must
    // pass retained(), whose old DATA currency still revokes the attachment.
    // The guarded adoption switches DATA and its matching immutable resource
    // index together; no request can observe a new snapshot with old pins.
    value.facts=facts
    value.resources='resources' in facts?facts.resources:undefined
    return project(value,facts) as BrowserSnapshotV2|BrowserSnapshotV3
  }
  function originalSourceLifetime(value:Attachment):(()=>boolean)|undefined {
    if(value.program.schemaVersion!==3||!('sourceCurrent' in value.facts))return undefined
    const facts=value.facts
    return ()=>!disposed&&attachments.get(value.binding.browserSessionId)===value
      &&value.ownerCurrent()&&facts.sourceCurrent()
  }
  async function handleCurrent(input:AuthorBrowserRequest,signal:AbortSignal):Promise<AuthorBrowserReply> {
    if(disposed)return {ok:false,code:'BROWSER_ATTACHMENT_REVOKED'}
    if(input.action==='dispose') {
      const old=attachments.get(input.binding.browserSessionId)
      if(old&&sameBinding(old.binding,input.binding))revoke(old)
      return {ok:true,kind:'disposed'}
    }
    const sid=input.action==='attach'?input.sessionId:input.action==='confirm'||input.action==='retry'?input.operation.sessionId:input.binding.sessionId
    const session=await deps.resolveSession(sid)
    if(!session)return {ok:false,code:'MVU_PLAYER_SESSION_INACTIVE'}
    if(input.action==='confirm') {
      // A page reload only asks the existing player for durable facts. Absence
      // of an operation cannot enter submit's new-operation reservation path.
      return {ok:true,kind:'confirmed',result:await deps.confirm(input.operation)}
    }
    if(input.action==='retry') {
      // This is the parent's explicit manual recovery command, using the same
      // Native player as the ordinary numerical editor. A lost child realm is
      // not an authority source; the actual Session/Agent and writer own it.
      const owner=deps.captureOwner(session.id)
      if(!owner)return {ok:false,code:'MVU_PLAYER_SESSION_INACTIVE'}
      return {ok:true,kind:'saved',result:await deps.submit(input.operation,owner)}
    }
    if(input.action==='attach') {
      const owner=deps.captureOwner(session.id)
      if(!owner)return {ok:true,kind:'inactive',code:'BROWSER_SESSION_INACTIVE'}
      const facts=await deps.captureFacts(session.id)
      if(!facts)return {ok:true,kind:'inactive',code:'BROWSER_PROGRAM_UNAVAILABLE'}
      if(!owner()||!facts.current())return fail('BROWSER_ATTACHMENT_REVOKED')
      let value=input.binding?attachments.get(input.binding.browserSessionId):undefined
      if(value&&(value.binding.sessionId!==session.id||!sameBinding(value.binding,input.binding!)||!value.current()
        ||value.program.programSha256!==facts.program.programSha256)) {
        revoke(value)
        value=undefined
      }
      if(!value) {
        const binding={browserSessionId:randomUUID(),generation:randomUUID(),sessionId:session.id,
          programSha256:facts.program.programSha256}
        value={binding,program:facts.program,artifact:facts.artifact,readRevision:0,facts,ownerCurrent:owner,
          ...('resources' in facts?{resources:facts.resources}:{}),
          current:()=>!disposed&&value!==undefined&&attachments.get(binding.browserSessionId)===value
            &&value.ownerCurrent()&&value.facts.current()}
        attachments.set(binding.browserSessionId,value)
      }
      const attachment={binding:value.binding,program:value.program,artifact:value.artifact,snapshot:project(value,facts)}
      return {ok:true,kind:'attached',attachment:value.program.schemaVersion===3
        ?{schemaVersion:3,encoding:'native-author-browser-attachment-v3',...attachment}
        :value.program.schemaVersion===2
        ?{schemaVersion:2,encoding:'native-author-browser-attachment-v2',...attachment}
        :{schemaVersion:1,encoding:'native-author-browser-attachment-v1',...attachment}} as AuthorBrowserReply
    }
    const value=retained(input.binding)
    if(input.action==='mutate-author-key') {
      if(value.program.schemaVersion!==3||!('sourceCurrent' in value.facts)||!deps.mutateAuthorKey)
        return {ok:false,code:'AUTHOR_CHAT_DECLARATION_UNAVAILABLE'}
      const sourceCurrent=originalSourceLifetime(value)!
      // Project only this action's DATA. Posted declaration/page/script fields
      // cannot replace the program selected by retained() or the Source owner.
      const {key,value:next,expected,operationId}=input.request
      const reply=await deps.mutateAuthorKey(session.id,value.program,
        {key,value:next,expected,operationId},sourceCurrent,signal)
      // A durable State receipt survives Stop/Source loss. Fresh DATA is adopted
      // only while the same original Source proof and Native owner still hold.
      try {
        const refreshed=await adoptCommittedFacts(value,sourceCurrent)
        return {ok:true,kind:'author-key-mutated',reply,
          ...refreshed?.schemaVersion===3?{snapshot:refreshed}:{}}
      }catch {return {ok:true,kind:'author-key-mutated',reply}}
    }
    if(input.action==='read-source-resource') {
      if(value.program.schemaVersion===1||!value.resources)return {ok:false,code:'AUTHOR_SCRIPT_RESOURCE_UNAVAILABLE'}
      if(!scriptCapability(value.program,input.request.scriptIdentity,'owned-script-source-resources')) {
        return {ok:false,code:'BROWSER_AUTHOR_REQUEST_INVALID'}
      }
      // This read is synchronous after the attachment's live Source/Session/Stop
      // check. Resource addressing never creates a second permission owner.
      return {ok:true,kind:'source-resource',value:value.resources.read(input.request)}
    }
    if(input.action==='capture')return {ok:true,kind:'snapshot',snapshot:await snapshot(value)}
    if(input.action!=='save')return {ok:false,code:'BROWSER_REQUEST_INVALID'}
    const request=input.request,operation=input.operation
    const canSave=value.program.schemaVersion===3
      ?value.program.scripts.find(row=>row.descriptor.identity===request.scriptIdentity)
        ?.requiredCapabilities.includes('owned-numerical-variable-replacement')
      :value.program.scripts.find(row=>row.descriptor.identity===request.scriptIdentity)
        ?.requiredCapabilities.includes('owned-numerical-player-save')
    if(request.generation!==value.binding.generation||!canSave
      ||operation.sessionId!==value.binding.sessionId||operation.schemaVersion!==1||operation.action!=='replace-values') {
      return {ok:false,code:'BROWSER_NUMERICAL_REQUEST_INVALID'}
    }
    // No await lies between this live attachment check and entering the actual
    // writer. Its own Native reservation/Source boundary decides publication.
    if(!value.current())return fail('BROWSER_ATTACHMENT_REVOKED')
    const result=await deps.submit(operation,value.current)
    // A committed operation survives a later revocation. Return its receipt so
    // parent storage can confirm it, without publishing readiness to a new realm.
    if(!value.current())return {ok:true,kind:'saved',result}
    try {
      const captured=await snapshot(value)
      // This signal follows the real numerical writer's new durable update and
      // the same Source's after-capture. It carries no fabricated MvuData and
      // does not claim the library's precommit variable-editing callback phase.
      return {ok:true,kind:'saved',result,snapshot:captured,
        ...value.program.schemaVersion===3&&result.operation?.outcome==='updated'&&!result.operation.replayed
          ?{sourceEvents:[{type:'mag_variable_update_ended',args:[]}]}:{}}
    }
    catch{return {ok:true,kind:'saved',result}}
  }
  function handle(input:AuthorBrowserRequest,signal:AbortSignal=new AbortController().signal):Promise<AuthorBrowserReply> {
    const binding='binding' in input?input.binding:undefined
    if(!binding||input.action==='dispose')return handleCurrent(input,signal)
    const key=binding.browserSessionId,previous=actionQueues.get(key)??Promise.resolve()
    // A self-authored intent dirties the old facts until its actual receipt is
    // adopted. Bound reads and writes wait together, then use retained() once.
    const result=previous.then(()=>handleCurrent(input,signal))
    const settled=result.then(()=>{},()=>{})
    actionQueues.set(key,settled)
    void settled.then(()=>{if(actionQueues.get(key)===settled)actionQueues.delete(key)})
    return result
  }
  deps.ctx.effect(()=>deps.ctx.connection.fetch.register({path:'/api/roleplay/author-browser',
    methods:['POST'],requestBody:'buffered',fetch:async(request:Request)=>{
      try {
        const text=await request.text()
        if(Buffer.byteLength(text,'utf8')>2*1048576)return jsonResponse(413,{ok:false,code:'MVU_PLAYER_DATA_LIMIT'})
        let input:AuthorBrowserRequest
        try{input=JSON.parse(text)}catch{return jsonResponse(400,{ok:false,code:'BROWSER_REQUEST_INVALID'})}
        if(!input||!['attach','capture','save','confirm','retry','dispose','read-source-resource','mutate-author-key'].includes(input.action)) {
          return jsonResponse(400,{ok:false,code:'BROWSER_REQUEST_INVALID'})
        }
        const result=await handle(input,request.signal)
        return jsonResponse(result.ok?200:409,result)
      }catch(error){return jsonResponse(409,{ok:false,code:codeOf(error)})}
    }}),'roleplay: owned author browser attachment')
  const invalidateSession=(sid:string)=>{
    for(const value of attachments.values())if(value.binding.sessionId===sid)revoke(value)
  }
  return {handle,invalidateSession,dispose:()=>{
    disposed=true;for(const value of attachments.values())revoke(value)
  }}
}
