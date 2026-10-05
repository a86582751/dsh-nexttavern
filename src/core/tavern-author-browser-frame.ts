/** Real parent transport/realm controller. BrowserSession placement, Core
 * admission, actual snapshot production and save adapter remain Root's owners. */
import {BROWSER_BUDGET_V1,BrowserBudgetError,quantifyBrowserTransport} from './tavern-author-browser-budget.js'
import type {BrowserBindingV1,BrowserHostBridgeV1,BrowserProgramV1,BrowserRenderV1,
  BrowserRuntimeArtifactV1,BrowserSaveReplyV1,BrowserSaveRequestV1,BrowserSnapshotV1} from './tavern-author-browser-types.mjs'

const CSP="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; "+
  "connect-src 'none'; img-src 'none'; media-src 'none'; font-src 'none'; frame-src 'none'; "+
  "worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"
const html=(javascript:string,configId:string,config:unknown)=>
  '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+CSP+'">'+
  '<style>html,body{margin:0;overflow:hidden}</style><body><script type="application/json" id="'+configId+'">'+
  JSON.stringify(config).replaceAll('<','\\u003c')+'</script><script>'+javascript.replace(/<\/script/gi,'<\\/script')+'</script></body>'
interface Options {
  current():boolean
  layout(value:{height:number;renderRevision:number}):void
  diagnostic(code:string):void
  failed?(code:string):void
  startupDeadlineMs:number
}

export function createBrowserRuntimeFrameV1(outer:HTMLIFrameElement,artifact:BrowserRuntimeArtifactV1,
  binding:BrowserBindingV1,program:BrowserProgramV1,host:BrowserHostBridgeV1,options:Options) {
  if(!host?.capture||!host.save)throw Error('BROWSER_HOST_BRIDGE_MISSING')
  if(program.runtime.implementationSha256!==artifact.identity.implementationSha256
    ||binding.programSha256!==program.programSha256)throw Error('BROWSER_RUNTIME_IMPLEMENTATION_MISMATCH')
  const nonce=crypto.randomUUID(),abort=new AbortController()
  let port:MessagePort|null=null,active=true,bound=false,initialized=false,sequence=0,lastChildSequence=0
  let latest:BrowserSnapshotV1|undefined,pendingRender:BrowserRenderV1|undefined
  let resolveStarted:()=>void=()=>{},rejectStarted:(reason:Error)=>void=()=>{}
  const started=new Promise<void>((resolve,reject)=>{resolveStarted=resolve;rejectStarted=reject})
  const same=()=>active&&options.current()
  const send=(type:string,data:Record<string,unknown>={})=>{
    if(same()&&port)port.postMessage({v:2,nonce,generation:binding.generation,browserSessionId:binding.browserSessionId,
      sequence:++sequence,type,...data})
  }
  function dispose() {
    if(!active)return
    send('revoke');active=false;abort.abort();window.clearTimeout(timer)
    port?.close();port=null;window.removeEventListener('message',onGuardMessage);outer.removeAttribute('srcdoc')
    rejectStarted(new Error('BROWSER_GENERATION_REVOKED'))
  }
  const fail=(code:string)=>{
    options.diagnostic(code);rejectStarted(new Error(code));dispose();options.failed?.(code)
  }
  const publishSnapshot=(snapshot:BrowserSnapshotV1)=>{
    if(!same())return
    if(snapshot.generation!==binding.generation||snapshot.basis.sessionId!==binding.sessionId) {
      fail('BROWSER_SNAPSHOT_BINDING_MISMATCH');return
    }
    quantifyBrowserTransport(snapshot,BROWSER_BUDGET_V1.snapshotBytes)
    if(latest&&snapshot.readRevision<latest.readRevision)return
    latest=snapshot
    if(initialized)send('snapshot',{snapshot})
  }
  const initialize=()=>{
    if(!same()||!bound||!latest||initialized)return
    quantifyBrowserTransport({program,snapshot:latest},BROWSER_BUDGET_V1.snapshotBytes)
    initialized=true;send('initialize',{program,snapshot:latest})
    if(pendingRender)send('render',{render:pendingRender})
  }
  const onPortMessage=(event:MessageEvent)=>{
    const data=event.data
    if(!same()||data?.v!==2||data.nonce!==nonce||data.generation!==binding.generation
      ||data.browserSessionId!==binding.browserSessionId||!Number.isSafeInteger(data.sequence)
      ||data.sequence<=lastChildSequence)return
    lastChildSequence=data.sequence
    if(data.type==='bound') {if(bound)return;bound=true;initialize()}
    else if(data.type==='startup-complete') {window.clearTimeout(timer);resolveStarted()}
    else if(['startup-failed','runtime-error','handler-error'].includes(data.type)) {
      if(data.type==='handler-error')options.diagnostic(String(data.code??'BROWSER_AUTHOR_ERROR'))
      else fail(String(data.code??'BROWSER_AUTHOR_ERROR'))
    }else if(data.type==='layout'&&Number.isFinite(data.height)&&data.height>=1&&data.height<=2_000_000) {
      outer.style.height=Math.ceil(data.height)+'px'
      outer.contentWindow?.postMessage({v:2,nonce,generation:binding.generation,type:'height',height:data.height},'*')
      options.layout({height:data.height,renderRevision:data.renderRevision})
    }else if(data.type==='rpc-save') {
      const request=data.request as BrowserSaveRequestV1
      const script=program.scripts.find(row=>row.descriptor.identity===request.scriptIdentity)
      if(!latest||request.generation!==binding.generation||request.readRevision!==latest.readRevision
        ||!script?.requiredCapabilities.includes('owned-numerical-player-save')) {
        send('rpc-denied',{requestId:request.requestId,code:'BROWSER_NUMERICAL_BASE_STALE'});return
      }
      // This adapter owns the actual parent operation and exact unknown retry.
      // Its pending request can outlive realm disposal; do not turn a cancelled
      // ACK into a newly generated operation or rerun an author callback.
      host.save(binding,request,abort.signal).then(reply=>{
        if(!same())return
        if(reply.requestId!==request.requestId||reply.generation!==binding.generation) {
          send('rpc-error',{requestId:request.requestId});return
        }
        const snapshot=latest&&latest.readRevision>reply.snapshot.readRevision?latest:reply.snapshot
        const outgoing={...reply,snapshot}
        quantifyBrowserTransport(outgoing,BROWSER_BUDGET_V1.snapshotBytes)
        latest=snapshot;send('rpc-result',{reply:outgoing})
      }).catch(()=>{if(same())send('rpc-error',{requestId:request.requestId})})
    }
  }
  function onGuardMessage(event:MessageEvent) {
    const data=event.data
    if(!same()||event.source!==outer.contentWindow||data?.v!==2||data.nonce!==nonce||data.generation!==binding.generation)return
    if(data.type==='guard-failed'){fail('BROWSER_REALM_NAVIGATED');return}
    if(data.type!=='transport-ready'||port)return
    const channel=new MessageChannel();port=channel.port1;port.onmessage=onPortMessage;port.start()
    outer.contentWindow?.postMessage({v:2,nonce,generation:binding.generation,type:'bind'},'*',[channel.port2])
  }
  // This deadline detects absent asynchronous startup/bridge completion. It is
  // not a hard termination mechanism for blocked same-renderer JavaScript.
  const timer=window.setTimeout(()=>fail('BROWSER_STARTUP_NOT_CONFIRMED'),options.startupDeadlineMs)
  window.addEventListener('message',onGuardMessage)
  const childDocument=html(artifact.childJavascript,'owned-browser-runtime-config',{nonce,binding,runtime:artifact.identity})
  outer.referrerPolicy='no-referrer'
  outer.srcdoc=html(artifact.guardJavascript,'owned-browser-guard-config',{nonce,generation:binding.generation,childDocument})
  host.capture(binding,abort.signal).then(snapshot=>{publishSnapshot(snapshot);initialize()})
    .catch(error=>{if(same())fail(error instanceof BrowserBudgetError?error.code:'BROWSER_SNAPSHOT_UNAVAILABLE')})
  return {
    started,dispose,publishSnapshot,
    render(render:BrowserRenderV1) {
      if(!same())return
      quantifyBrowserTransport(render,BROWSER_BUDGET_V1.snapshotBytes)
      pendingRender=render;if(initialized)send('render',{render})
    },
    /** Real parent receipt confirmation, preserving the original requestId and
     * operation. No new author transformation or save request is performed. */
    publishSaveConfirmation(reply:BrowserSaveReplyV1) {
      if(!same()||reply.generation!==binding.generation)return
      const snapshot=latest&&latest.readRevision>reply.snapshot.readRevision?latest:reply.snapshot
      const outgoing={...reply,snapshot}
      quantifyBrowserTransport(outgoing,BROWSER_BUDGET_V1.snapshotBytes)
      latest=snapshot;send('rpc-result',{reply:outgoing})
    },
  }
}

