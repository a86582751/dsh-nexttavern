/** Main parent owns the actual Worker, deadlines, native gesture admission and
 * resource realm. Browser transport DATA cannot mint any of these owners. */
import {quantifyBrowserTransport,BROWSER_BUDGET_V1} from './tavern-author-browser-budget.js'
import type {BrowserBindingV2,BrowserFrameControllerV2,BrowserHostBridgeV2,BrowserProgramV2,
  BrowserRenderV2,BrowserRuntimeArtifactV2,BrowserSaveReplyV2,BrowserSnapshotV2}
  from './tavern-author-browser-types-v2.mjs'
import type {BrowserCallbackRegistrationV2,BrowserGenerationInvocationV2,BrowserGenerationResultV2}
  from './roleplay-author-browser-generation-types.js'

interface Options {
  current():boolean
  layout(value:{height:number;renderRevision:number}):void
  diagnostic(code:string):void
  failed?(code:string):void
  startupDeadlineMs:number
}
const escape=(value:unknown)=>JSON.stringify(value).replaceAll('<','\\u003c')
function html(javascript:string,id:string,config:unknown,nonce:string,child:boolean):string {
  const policy="default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'unsafe-inline'; "+
    "connect-src 'none'; img-src "+(child?'https: http: data: blob:':"'none'")+"; media-src 'none'; "+
    "font-src 'none'; frame-src "+(child?"'none'":'about:')+"; worker-src 'none'; object-src 'none'; "+
    "form-action 'none'; base-uri 'none'"
  return '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'+policy+'">'+
    '<style>html,body{margin:0;overflow:hidden}</style><body><script type="application/json" nonce="'+nonce+'" id="'+id+'">'+
    escape(config)+'</script><script nonce="'+nonce+'">'+javascript.replace(/<\/script/gi,'<\\/script')+'</script></body>'
}

export function createBrowserRuntimeFrameV2(outer:HTMLIFrameElement,artifact:BrowserRuntimeArtifactV2,
  binding:BrowserBindingV2,program:BrowserProgramV2,host:BrowserHostBridgeV2,options:Options):BrowserFrameControllerV2 {
  const nonce=crypto.randomUUID(),abort=new AbortController()
  const workerURL=URL.createObjectURL(new Blob([artifact.executionWorkerJavascript],{type:'text/javascript'}))
  const worker=new Worker(workerURL,{type:'module'})
  let active=true,port:MessagePort|null=null,initialized=false,sequence=0
  let latest:BrowserSnapshotV2|undefined,pendingRender:BrowserRenderV2|undefined
  let registrations:readonly BrowserCallbackRegistrationV2[]=[]
  let resolveStarted:()=>void=()=>{},rejectStarted:(error:Error)=>void=()=>{}
  const started=new Promise<void>((resolve,reject)=>{resolveStarted=resolve;rejectStarted=reject})
  const pendingGeneration=new Map<string,{resolve:(result:BrowserGenerationResultV2)=>void;invocation:BrowserGenerationInvocationV2}>()
  const work=new Set<string>(),gestures=new Map<string,{callbackId:number;scriptIdentity:string;consumed:boolean}>()
  const workTimers=new Map<string,number>()
  const rawWaiting=new Set<number>()
  let timer=0,startedComplete=false
  const current=()=>active&&options.current()
  const send=(message:any)=>{if(current())worker.postMessage(message)}
  function deadline() {
    window.clearTimeout(timer)
    if(!startedComplete)timer=window.setTimeout(()=>fail('BROWSER_WORKER_DEADLINE'),options.startupDeadlineMs)
  }
  function workDeadline(id:string) {
    const old=workTimers.get(id);if(old!==undefined)window.clearTimeout(old)
    if(work.has(id))workTimers.set(id,window.setTimeout(()=>fail('BROWSER_WORKER_DEADLINE'),options.startupDeadlineMs))
  }
  function dispose() {
    if(!active)return
    active=false;abort.abort();window.clearTimeout(timer)
    for(const pending of workTimers.values())window.clearTimeout(pending);workTimers.clear()
    // Termination is independent of guest responsiveness and provider replies.
    worker.terminate();URL.revokeObjectURL(workerURL);gestures.clear();rawWaiting.clear();work.clear()
    port?.postMessage({type:'dispose'});port?.close();port=null
    window.removeEventListener('message',guardMessage);outer.removeAttribute('srcdoc')
    rejectStarted(Error('BROWSER_GENERATION_REVOKED'))
    for(const pending of pendingGeneration.values())pending.resolve({kind:'cancelled',binding,
      invocationId:pending.invocation.invocationId,diagnostics:[{code:'BROWSER_GENERATION_REVOKED'}]})
    pendingGeneration.clear()
  }
  function fail(code:string) {if(!active)return;options.diagnostic(code);rejectStarted(Error(code));dispose();options.failed?.(code)}
  function initialize() {
    if(!current()||!port||!childDocument||!latest||initialized)return
    initialized=true
    port.postMessage({type:'snapshot',persona:latest.persona})
    if(pendingRender)port.postMessage({type:'render',render:pendingRender})
    const bytes=Uint8Array.from(atob(artifact.wasm.data),character=>character.charCodeAt(0))
    send({type:'start',binding,program,snapshot:latest,document:childDocument,wasm:bytes.buffer})
  }
  let childDocument:unknown
  function childMessage(event:MessageEvent) {
    const message=event.data;if(!current())return
    if(message.type==='child-ready'){childDocument=message.document;initialize()}
    else if(message.type==='rpc-result')send({type:'dom-result',id:message.id,value:message.value,error:message.error})
    else if(message.type==='callback') {
      let gestureId:string|undefined
      // Only the trusted child MessagePort can report the native default form
      // chain. The main parent binds its own token to this live callback.
      if(message.trustedFormGesture) {
        gestureId=crypto.randomUUID()
        gestures.set(gestureId,{callbackId:message.callbackId,scriptIdentity:message.scriptIdentity,consumed:false})
      }
      send({...message,gestureId})
    }else if(message.type==='layout') {
      outer.style.height=Math.ceil(message.height)+'px'
      outer.contentWindow?.postMessage({v:2,nonce,generation:binding.generation,type:'height',height:message.height},'*')
      options.layout({height:message.height,renderRevision:message.renderRevision})
    }
  }
  async function hostRequest(message:any,synchronous=false) {
    const {payload,id}=message
    const script=program.scripts.find(row=>row.descriptor.identity===payload.scriptIdentity)
    const type=synchronous?'dom-result':'host-result'
    if(!script){send({type,id,error:'BROWSER_SCRIPT_NOT_OWNED'});return}
    try {
      let value:unknown
      if(payload.kind==='generate-raw') {
        const gesture=gestures.get(payload.request.gestureId)
        if(!gesture||gesture.consumed||gesture.scriptIdentity!==payload.scriptIdentity
          ||gesture.callbackId!==payload.callbackId||!host.generateRaw)
          throw Error('BROWSER_TRUSTED_FORM_REQUIRED')
        gesture.consumed=true;gestures.delete(payload.request.gestureId)
        rawWaiting.add(id)
        const timer=workTimers.get(message.workId)
        if(timer!==undefined){window.clearTimeout(timer);workTimers.delete(message.workId)}
        try{value=await host.generateRaw(binding,payload.request,abort.signal)}
        finally{rawWaiting.delete(id);if(current()&&message.workId)workDeadline(message.workId)}
      }else if(payload.kind==='update-author-chat') {
        if(!host.updateAuthorChat||program.ownedChatWriter?.ordinal!==script.ordinal)throw Error('BROWSER_CHAT_UPDATE_NOT_ADMITTED')
        value=await host.updateAuthorChat(binding,payload.request,abort.signal)
      }else if(payload.kind==='save')value=await host.save(binding,payload.request,abort.signal)
      else throw Error('BROWSER_HOST_OPERATION_UNSUPPORTED')
      if(current())send({type,id,value})
    }catch(error){if(current())send({type,id,error:error instanceof Error?error.message:'BROWSER_HOST_OPERATION_FAILED'})}
  }
  worker.addEventListener('message',event=>{
    const message=event.data;if(!current())return
    if(message.type==='dom-rpc') {
      if(message.payload.op==='author-chat-update')void hostRequest({...message,
        payload:{...message.payload,kind:'update-author-chat'}},true)
      else port?.postMessage({type:'rpc',id:message.id,payload:message.payload})
    }
    else if(message.type==='host-rpc')void hostRequest(message)
    else if(message.type==='startup-complete') {
      registrations=message.registrations;startedComplete=true;deadline();resolveStarted()
    }else if(message.type==='work-start'){work.add(message.id);workDeadline(message.id)}
    else if(message.type==='work-end'){
      work.delete(message.id);const timer=workTimers.get(message.id)
      if(timer!==undefined)window.clearTimeout(timer);workTimers.delete(message.id)
    }
    else if(message.type==='generation-result') {
      const pending=pendingGeneration.get(message.id)
      if(pending){pendingGeneration.delete(message.id);pending.resolve(message.result)}
    }else if(message.type==='handler-error')options.diagnostic(message.code)
    else if(message.type==='runtime-error'||message.type==='startup-failed')fail(message.code)
  })
  worker.addEventListener('error',()=>fail('BROWSER_WORKER_FAILED'))
  function guardMessage(event:MessageEvent) {
    const message=event.data
    if(!current()||event.source!==outer.contentWindow||message?.v!==2||message.nonce!==nonce||message.generation!==binding.generation)return
    if(message.type==='guard-failed'){fail('BROWSER_REALM_NAVIGATED');return}
    if(message.type!=='transport-ready'||port)return
    const channel=new MessageChannel();port=channel.port1;port.onmessage=childMessage;port.start()
    outer.contentWindow?.postMessage({v:2,nonce,generation:binding.generation,type:'bind'},'*',[channel.port2])
  }
  const publishSnapshot=(snapshot:BrowserSnapshotV2)=>{
    if(!current())return
    quantifyBrowserTransport(snapshot,BROWSER_BUDGET_V1.snapshotBytes)
    if(latest&&snapshot.readRevision<latest.readRevision)return
    latest=snapshot
    if(initialized){send({type:'snapshot',snapshot});port?.postMessage({type:'snapshot',persona:snapshot.persona})}
    else initialize()
  }
  window.addEventListener('message',guardMessage)
  outer.referrerPolicy='no-referrer'
  const child=html(artifact.childJavascript,'owned-browser-runtime-config',{
    nonce,binding,baseURI:document.baseURI,mediaSources:program.scripts.flatMap(script=>script.mediaSources)},nonce,true)
  outer.srcdoc=html(artifact.guardJavascript,'owned-browser-guard-config',{
    nonce,generation:binding.generation,childDocument:child},nonce,false)
  deadline()
  host.capture(binding,abort.signal).then(publishSnapshot).catch(()=>{if(current())fail('BROWSER_SNAPSHOT_UNAVAILABLE')})
  return {
    started,get registrations(){return registrations},dispose,publishSnapshot,
    render(render:BrowserRenderV2) {
      if(!current())return
      quantifyBrowserTransport(render,BROWSER_BUDGET_V1.snapshotBytes);pendingRender=render
      if(initialized)port?.postMessage({type:'render',render})
    },
    publishSaveConfirmation(reply:BrowserSaveReplyV2){publishSnapshot(reply.snapshot)},
    invokeGeneration(invocation:BrowserGenerationInvocationV2) {
      if(!current())return Promise.resolve({kind:'cancelled' as const,binding,invocationId:invocation.invocationId,
        diagnostics:[{code:'BROWSER_GENERATION_REVOKED'}]})
      const id='generation:'+ ++sequence
      return new Promise<BrowserGenerationResultV2>(resolve=>{
        pendingGeneration.set(id,{resolve,invocation});send({type:'generation',id,invocation})
      })
    },
  }
}
