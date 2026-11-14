/** The live Reader operation, Source FIFO and actual Native task own author
 * dialogue. Guest request records only identify those existing owners. */
import {recordSha256} from './roleplay-data.js'
import type {AuthorChatNamespaceV3} from './roleplay-author-chat-state-types.js'
import type {AdmittedAuthorDialogTarget,AuthorDialogPromptV1,AuthorDialogResultV1} from './roleplay-author-dialog.js'
import type {AuthorNativeGenerateRawRequestV1} from './roleplay-author-browser-types.js'
import type {AuthorNativeProgramV1,AuthorNativeRealmV1} from './author-native-program.mjs'

interface CapturedPrompt {
  readonly prompt:AuthorDialogPromptV1
  assertCurrent():void
  release():void
}
interface Dependencies {
  capturePrompt(sid:string,target:AdmittedAuthorDialogTarget,request:AuthorNativeGenerateRawRequestV1,
    operationId:string,current:()=>boolean,signal:AbortSignal):Promise<CapturedPrompt>
  requestTask(sid:string,prompt:AuthorDialogPromptV1,current:()=>boolean,signal:AbortSignal)
    :Promise<AuthorDialogResultV1>
  /** Returns an actual Source closure, without reading the State head that
   * this very operation will change. Capture occurs before acquiring FIFO. */
  captureCurrent(sid:string,program:AuthorNativeProgramV1,current:()=>boolean):Promise<{
    readonly namespace:AuthorChatNamespaceV3;readonly current:()=>boolean}>
}
function fail(code:string):never {throw Error(code)}
export function createRoleplayAuthorBrowserDialogCoreV1(deps:Dependencies) {
  const requests=new Map<string,{requestSha256:string;result:Promise<AuthorDialogResultV1>;
    current:()=>boolean;controller:AbortController}>()
  let closed=false
  const assertLive=(current:()=>boolean,signal:AbortSignal)=>{
    signal.throwIfAborted()
    if(closed||!current())fail('BROWSER_ATTACHMENT_REVOKED')
  }
  async function generateRaw(sid:string,program:AuthorNativeProgramV1,realm:AuthorNativeRealmV1,
    request:AuthorNativeGenerateRawRequestV1,
    current:()=>boolean,signal:AbortSignal) {
    assertLive(current,signal)
    const source=await deps.captureCurrent(sid,program,current),binding={namespace:source.namespace,
      programSha256:program.programSha256,realmId:realm.realmId,groupId:realm.groupId}
    assertLive(source.current,signal)
    const operationId=recordSha256({schemaVersion:1,encoding:'author-native-dialog-operation-v1',binding,
      operationId:request.operationId}),requestSha256=recordSha256(request),prior=requests.get(operationId)
    if(prior&&prior.requestSha256!==requestSha256)fail('AUTHOR_CHAT_OPERATION_CHANGED')
    let result=prior?.result
    if(!result) {
      const controller=new AbortController(),requestSignal=AbortSignal.any([signal,controller.signal])
      const target:AdmittedAuthorDialogTarget={binding}
      result=(async()=>{
        const captured=await deps.capturePrompt(sid,target,request,operationId,current,requestSignal)
        try {
          assertLive(current,requestSignal);captured.assertCurrent()
          const owner=()=>{
            try {assertLive(current,requestSignal);captured.assertCurrent();return true}catch {return false}
          }
          const completed=await deps.requestTask(sid,captured.prompt,owner,requestSignal)
          assertLive(current,requestSignal);captured.assertCurrent()
          return completed
        }finally {captured.release()}
      })()
      requests.set(operationId,{requestSha256,result,current,controller})
      // An interrupted provider run is not a completed receipt. A manual
      // retry may ask TaskHost to resume its actual reserved Native job.
      void result.catch(()=>{if(requests.get(operationId)?.result===result)requests.delete(operationId)})
    }
    const completed=await result
    assertLive(current,signal)
    return {text:completed.text,task:completed.task}
  }
  function releaseOwner(current:()=>boolean) {
    for(const [id,request] of requests)if(request.current===current) {
      requests.delete(id)
      request.controller.abort(Error('BROWSER_ATTACHMENT_REVOKED'))
    }
  }
  return {generateRaw,releaseOwner,dispose:()=>{
    closed=true
    for(const request of requests.values())request.controller.abort(Error('BROWSER_ATTACHMENT_REVOKED'))
    requests.clear()
  }}
}
