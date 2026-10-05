/** Core owns attachment lifetime; the existing Native player owns every write.
 * Retained compiled DATA never reconstructs an attachment after Core disposal. */
import {randomUUID} from 'node:crypto'
import {jsonResponse} from './roleplay-state.js'
import type {BrowserBindingV1,BrowserProgramV1,BrowserRuntimeArtifactV1,
  BrowserSnapshotV1} from './tavern-author-browser-types.mjs'
import type {MvuPlayerEditResponse} from './roleplay-mvu-player-types.js'
import type {AuthorBrowserRequestV1,AuthorBrowserReplyV1} from './roleplay-author-browser-types.js'

export interface AuthorBrowserCapturedFacts {
  readonly program:BrowserProgramV1
  readonly artifact:BrowserRuntimeArtifactV1
  readonly data:Omit<BrowserSnapshotV1,'generation'|'readRevision'>
  current():boolean
}
interface Dependencies {
  ctx:{effect(work:()=>unknown,label?:string):unknown;connection:{fetch:{register(route:unknown):unknown}}}
  resolveSession(id:unknown):Promise<{id:string}|null|undefined>
  /** Captures the actual Session, Agent, catalog selection and Stop generation. */
  captureOwner(sid:string):(()=>boolean)|undefined
  captureFacts(sid:string):Promise<AuthorBrowserCapturedFacts|undefined>
  submit(input:unknown,current:()=>boolean):Promise<MvuPlayerEditResponse>
  confirm(input:unknown):Promise<MvuPlayerEditResponse>
}
interface Attachment {
  readonly binding:BrowserBindingV1
  readonly program:BrowserProgramV1
  readonly artifact:BrowserRuntimeArtifactV1
  current():boolean
  readRevision:number
}
const sameBinding=(left:BrowserBindingV1,right:BrowserBindingV1)=>
  left.browserSessionId===right.browserSessionId&&left.generation===right.generation
  &&left.sessionId===right.sessionId&&left.programSha256===right.programSha256
const codeOf=(error:unknown)=>error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
  ?error.message:'BROWSER_ATTACHMENT_UNAVAILABLE'

export function createRoleplayAuthorBrowser(deps:Dependencies) {
  const attachments=new Map<string,Attachment>()
  let disposed=false
  const fail=(code:string):never=>{throw Error(code)}
  function retained(binding:BrowserBindingV1):Attachment {
    const value=attachments.get(binding.browserSessionId)
    if(!value||!sameBinding(value.binding,binding))return fail('BROWSER_ATTACHMENT_REVOKED')
    if(!value.current()) {
      attachments.delete(binding.browserSessionId)
      return fail('BROWSER_ATTACHMENT_REVOKED')
    }
    return value
  }
  function project(value:Attachment,facts:AuthorBrowserCapturedFacts):BrowserSnapshotV1 {
    if(!value.current()||!facts.current()||facts.program.programSha256!==value.program.programSha256) {
      return fail('BROWSER_ATTACHMENT_REVOKED')
    }
    return {...facts.data,generation:value.binding.generation,readRevision:++value.readRevision}
  }
  async function snapshot(value:Attachment):Promise<BrowserSnapshotV1> {
    const facts=await deps.captureFacts(value.binding.sessionId)
    if(!facts)return fail('BROWSER_PROGRAM_UNAVAILABLE')
    return project(value,facts)
  }
  async function handle(input:AuthorBrowserRequestV1):Promise<AuthorBrowserReplyV1> {
    if(disposed)return {ok:false,code:'BROWSER_ATTACHMENT_REVOKED'}
    if(input.action==='dispose') {
      const old=attachments.get(input.binding.browserSessionId)
      if(old&&sameBinding(old.binding,input.binding))attachments.delete(input.binding.browserSessionId)
      return {ok:true,kind:'disposed'}
    }
    const sid=input.action==='attach'?input.sessionId:input.action==='confirm'||input.action==='retry'
      ?input.operation.sessionId:input.binding.sessionId
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
        attachments.delete(value.binding.browserSessionId)
        value=undefined
      }
      if(!value) {
        const binding={browserSessionId:randomUUID(),generation:randomUUID(),sessionId:session.id,
          programSha256:facts.program.programSha256}
        value={binding,program:facts.program,artifact:facts.artifact,readRevision:0,
          current:()=>!disposed&&attachments.get(binding.browserSessionId)===value&&owner()&&facts.current()}
        attachments.set(binding.browserSessionId,value)
      }
      return {ok:true,kind:'attached',attachment:{schemaVersion:1,encoding:'native-author-browser-attachment-v1',
        binding:value.binding,program:value.program,artifact:value.artifact,snapshot:project(value,facts)}}
    }
    const value=retained(input.binding)
    if(input.action==='capture')return {ok:true,kind:'snapshot',snapshot:await snapshot(value)}
    if(input.action!=='save')return {ok:false,code:'BROWSER_REQUEST_INVALID'}
    const request=input.request,operation=input.operation
    const script=value.program.scripts.find(row=>row.descriptor.identity===request.scriptIdentity)
    if(request.generation!==value.binding.generation||!script?.requiredCapabilities.includes('owned-numerical-player-save')
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
    try{return {ok:true,kind:'saved',result,snapshot:await snapshot(value)}}
    catch{return {ok:true,kind:'saved',result}}
  }
  deps.ctx.effect(()=>deps.ctx.connection.fetch.register({path:'/api/roleplay/author-browser',
    methods:['POST'],requestBody:'buffered',fetch:async(request:Request)=>{
      try {
        const text=await request.text()
        if(Buffer.byteLength(text,'utf8')>2*1048576)return jsonResponse(413,{ok:false,code:'MVU_PLAYER_DATA_LIMIT'})
        let input:AuthorBrowserRequestV1
        try{input=JSON.parse(text)}catch{return jsonResponse(400,{ok:false,code:'BROWSER_REQUEST_INVALID'})}
        if(!input||!['attach','capture','save','confirm','retry','dispose'].includes(input.action)) {
          return jsonResponse(400,{ok:false,code:'BROWSER_REQUEST_INVALID'})
        }
        const result=await handle(input)
        return jsonResponse(result.ok?200:409,result)
      }catch(error){return jsonResponse(409,{ok:false,code:codeOf(error)})}
    }}),'roleplay: owned author browser attachment')
  const invalidateSession=(sid:string)=>{
    for(const [id,value] of attachments)if(value.binding.sessionId===sid)attachments.delete(id)
  }
  return {handle,invalidateSession,dispose:()=>{disposed=true;attachments.clear()}}
}
