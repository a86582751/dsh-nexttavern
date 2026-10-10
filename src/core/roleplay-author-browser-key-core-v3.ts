/** The retained Core attachment selects the actual program. This owner joins
 * its declared key to the canonical State writer inside the existing Source
 * FIFO; page/job identity and posted declaration records grant no permission. */
import {deriveAuthorChatBindingV2} from './roleplay-author-chat-state.js'
import type {CanonicalAuthorChatStateV1} from './roleplay-author-chat-state.js'
import type {BrowserProgramV3,BrowserOrdinaryKeyRequestV3,BrowserOrdinaryKeyReplyV3}
  from './tavern-author-browser-types-v3.mjs'

interface Dependencies {
  readonly state:Pick<CanonicalAuthorChatStateV1,'commitOrdinary'>
  /** Captures the actual Source once, excluding canonical State2 output rows
   * from Source membership/head currency. current is the retained attachment's
   * Source/lifecycle proof, not its soon-stale authorChats DATA capture. The
   * original proof must also guard the enclosing service's post-ACK adoption. */
  captureCurrent(sid:string,program:BrowserProgramV3,current:()=>boolean):Promise<()=>boolean>
  withSourceLock<T>(sid:string,work:()=>Promise<T>,signal:AbortSignal):Promise<T>
}
function fail(code:string):never {throw Error(code)}

export function createRoleplayAuthorBrowserKeyCoreV3(deps:Dependencies) {
  let closed=false
  async function mutate(sid:string,program:BrowserProgramV3,request:BrowserOrdinaryKeyRequestV3,
    current:()=>boolean,signal:AbortSignal):Promise<BrowserOrdinaryKeyReplyV3> {
    signal.throwIfAborted()
    if(closed||!current())fail('BROWSER_ATTACHMENT_REVOKED')
    // Only the private Core attachment passes program here. The HTTP request
    // carries a key/value/revision, never this Source declaration or binding.
    const declaration=program.declarations.find(row=>row.key===request.key&&row.kind==='ordinary-source-key')
    if(!declaration)fail('AUTHOR_CHAT_DECLARATION_UNAVAILABLE')
    const binding=deriveAuthorChatBindingV2(sid,program,declaration)
    const sourceCurrent=await deps.captureCurrent(sid,program,current)
    return deps.withSourceLock(sid,async()=>{
      signal.throwIfAborted()
      const live=()=>!closed&&!signal.aborted&&sourceCurrent()
      if(!live())fail('BROWSER_ATTACHMENT_REVOKED')
      const result=await deps.state.commitOrdinary({binding,expected:request.expected,
        operationId:request.operationId,value:request.value,
        declaration:{declarationId:declaration.declarationId,
          writerIdentitySha256:declaration.writerIdentitySha256,writer:declaration.writer}},
      {
        // Membership was selected from this retained program above. State
        // clones the update; storage awaits check only its actual lifetime.
        ownsDeclaration:()=>true,
        isCurrent:live,
      })
      return {kind:result.kind,capture:{declarationId:declaration.declarationId,capture:result.capture}}
    },signal)
  }
  return {mutate,dispose:()=>{closed=true}}
}
