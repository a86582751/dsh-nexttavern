/** The retained native attachment admits one actual realm. State owns namespace
 * revisions, Source FIFO, the immutable operation and its durable receipt. */
import {authorNativeNamespaceCauseV1} from './author-native-origin.js'
import {applyAuthorChatOverlayV3,prepareOrdinaryAuthorChatBatchV3} from './roleplay-author-chat-state-types.js'
import type {AuthorChatNamespaceV3,OrdinaryAuthorChatBatchUpdateV3} from './roleplay-author-chat-state-types.js'
import {recordSha256} from './roleplay-data.js'
import {createAuthorNativeMessageVariables} from './author-native-message-variables.js'
import type {CanonicalAuthorChatStateV1} from './roleplay-author-chat-state.js'
import type {AuthorNativeProgramV1,AuthorNativeRealmV1} from './author-native-program.mjs'
import type {AuthorNativeNamespaceRequestV1,AuthorBrowserSnapshot} from './roleplay-author-browser-types.js'
import type {AuthorNativeNamespaceReplyV1 as BrowserOrdinaryNamespaceReplyV3} from './roleplay-author-browser-types.js'
import type {AuthorNativeSelfScriptV1} from './author-native-helper-types.js'
import type {MvuJsonObject,MvuJsonValue} from './tavern-mvu-initvar.js'
import type {AuthorChatNamespaceRootV3} from './roleplay-author-chat-state-types.js'

export interface CapturedOrdinaryNamespaceMutationV1 {
  readonly root:AuthorChatNamespaceRootV3
  readonly previous:MvuJsonObject
  readonly nextVariables:Readonly<MvuJsonObject>
  readonly operationId:string
  readonly cause:MvuJsonValue
}

interface Dependencies {
  readonly state:Pick<CanonicalAuthorChatStateV1,'commitOrdinaryBatchV3'>
  /** Captures the actual Source once, excluding canonical State2 output rows
   * from Source membership/head currency. current is the retained attachment's
   * Source/lifecycle proof, not its soon-stale authorChats DATA capture. The
   * original proof must also guard the enclosing service's post-ACK adoption. */
  captureCurrent(sid:string,current:()=>boolean):Promise<{
    readonly namespace:AuthorChatNamespaceV3;readonly current:()=>boolean}>
  withSourceLock<T>(sid:string,work:()=>Promise<T>,signal:AbortSignal):Promise<T>
}
function fail(code:string):never {throw Error(code)}
function ownScript(program:AuthorNativeProgramV1,realm:AuthorNativeRealmV1) {
  const scripts=program.scripts.filter(script=>script.enabled&&script.realmId===realm.realmId)
  if(scripts.length!==1||!program.realms.some(row=>row.realmId===realm.realmId&&row.groupId===realm.groupId))
    fail('AUTHOR_NATIVE_SCRIPT_ADDRESS_UNAVAILABLE')
  return scripts[0]!
}

export function createRoleplayAuthorBrowserKeyCoreV3(deps:Dependencies) {
  let closed=false
  async function mutateCapturedNamespace(sid:string,input:CapturedOrdinaryNamespaceMutationV1,
    current:()=>boolean,signal:AbortSignal):Promise<BrowserOrdinaryNamespaceReplyV3> {
    signal.throwIfAborted()
    if(closed||!current())fail('BROWSER_ATTACHMENT_REVOKED')
    const {previous,nextVariables:next,root,cause}=input
    if(!next||typeof next!=='object'||Array.isArray(next))fail('BROWSER_CHAT_UPDATE_RESULT_INVALID')
    if(Object.hasOwn(previous,'stat_data')!==Object.hasOwn(next,'stat_data')
      ||Object.hasOwn(previous,'stat_data')&&recordSha256(previous.stat_data)!==recordSha256(next.stat_data))
      fail('AUTHOR_CHAT_NUMERICAL_KEY_RESERVED')
    const {stat_data:_before,...basisValues}=previous
    const source=await deps.captureCurrent(sid,current)
    const {target:_target,...sourceNamespace}=root.namespace
    if(recordSha256(source.namespace)!==recordSha256(sourceNamespace))fail('AUTHOR_CHAT_BINDING_CHANGED')
    return deps.withSourceLock(sid,async()=>{
      signal.throwIfAborted()
      const live=()=>!closed&&!signal.aborted&&source.current()
      if(!live())fail('BROWSER_ATTACHMENT_REVOKED')
      return deps.state.commitOrdinaryBatchV3(prepareOrdinaryAuthorChatBatchV3(root,next,input.operationId,cause),
        {basisValues,ownsNamespace:()=>true,isCurrent:live})
    },signal)
  }
  async function retryCapturedNamespace(sid:string,operation:OrdinaryAuthorChatBatchUpdateV3,cause:MvuJsonValue,
    current:()=>boolean,signal:AbortSignal):Promise<BrowserOrdinaryNamespaceReplyV3> {
    signal.throwIfAborted()
    if(closed||!current())fail('BROWSER_ATTACHMENT_REVOKED')
    if(recordSha256(operation.cause)!==recordSha256(cause))fail('AUTHOR_CHAT_RECOVERY_SOURCE_CHANGED')
    const source=await deps.captureCurrent(sid,current)
    const {target:_target,...sourceNamespace}=operation.namespace
    if(recordSha256(source.namespace)!==recordSha256(sourceNamespace))fail('AUTHOR_CHAT_BINDING_CHANGED')
    return deps.withSourceLock(sid,async()=>{
      const live=()=>!closed&&!signal.aborted&&source.current()
      if(!live())fail('BROWSER_ATTACHMENT_REVOKED')
      // Retry consumes State's original immutable operation, never a new diff
      // derived from the currently displayed page or a superseded read basis.
      return deps.state.commitOrdinaryBatchV3(operation,{ownsNamespace:()=>true,isCurrent:live})
    },signal)
  }
  async function mutateNamespace(sid:string,program:AuthorNativeProgramV1,realm:AuthorNativeRealmV1,
    request:AuthorNativeNamespaceRequestV1,basis:AuthorBrowserSnapshot,current:()=>boolean,
    signal:AbortSignal):Promise<BrowserOrdinaryNamespaceReplyV3> {
    const cause=authorNativeNamespaceCauseV1(program.programSha256,realm)
    const next=request.nextVariables
    const selector=request.selector,scope=basis.scopeFrame.scopes.chat
    let capture=basis.ordinaryChat,previous
    if(selector?.type==='script') {
      const script=ownScript(program,realm),self=(basis.context?.realmScripts as
        Readonly<Record<string,AuthorNativeSelfScriptV1>>|undefined)?.[realm.realmId]
      if(!self||self.identity!==script.identity||self.ordinary.root.namespace.target?.kind!=='script'
        ||self.ordinary.root.namespace.target.identity.scriptIdentity!==script.identity)
        fail('AUTHOR_NATIVE_SCRIPT_ADDRESS_UNAVAILABLE')
      if(self.variables===undefined)fail('AUTHOR_NATIVE_SCRIPT_VARIABLES_UNAVAILABLE')
      capture=self.ordinary;previous=self.variables
    }else if(selector) {
      const selected=createAuthorNativeMessageVariables(basis).resolve(selector,true)
      capture=selected.capture!;previous=selected.values
    }else previous=applyAuthorChatOverlayV3(scope.kind==='available'?scope.variables:{},capture)
    return mutateCapturedNamespace(sid,{root:capture.root,previous,nextVariables:next,
      operationId:request.operationId,cause},current,signal)
  }
  async function retryNamespace(sid:string,program:AuthorNativeProgramV1,realm:AuthorNativeRealmV1,
    operation:OrdinaryAuthorChatBatchUpdateV3,current:()=>boolean,
    signal:AbortSignal):Promise<BrowserOrdinaryNamespaceReplyV3> {
    if(operation.namespace.target?.kind==='script'
      &&operation.namespace.target.identity.scriptIdentity!==ownScript(program,realm).identity)
      fail('AUTHOR_CHAT_NAMESPACE_UNAVAILABLE')
    return retryCapturedNamespace(sid,operation,authorNativeNamespaceCauseV1(program.programSha256,realm),current,signal)
  }
  return {mutateNamespace,retryNamespace,mutateCapturedNamespace,retryCapturedNamespace,dispose:()=>{closed=true}}
}
