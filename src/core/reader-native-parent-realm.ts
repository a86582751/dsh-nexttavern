/** Browser policy for Source-owned native pages. The credentialless parent
 * supplies an ephemeral network partition before private DATA is delivered. */
export const READER_NATIVE_RESOURCE_CSP="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' http: https: blob:; "
  +"style-src 'unsafe-inline' http: https:; img-src http: https: data: blob:; font-src http: https: data:; "
  +"media-src http: https: data: blob:; connect-src http: https:; frame-src http: https: about: data: blob:; "
  +"base-uri http: https:; form-action 'none'"

/** This static shell is served from an origin unique to one Reader permission
 * group. Its child shares that origin, while Main retains every Core port. */
function readerNativeParentBootstrap():void {
  const channel=new URLSearchParams(location.hash.slice(1)).get('channel')
  const connect=(event:MessageEvent)=>{
    if(event.data?.op!=='connect-parent'||event.data.channel!==channel||!event.ports[0])return
    removeEventListener('message',connect)
    const port=event.ports[0]
    if((window as any).credentialless!==true){
      port.postMessage({op:'parent-error',code:'READER_NATIVE_CREDENTIALLESS_UNAVAILABLE'});port.close();return
    }
    port.onmessage=message=>{
      if(message.data.op!=='mount')return
      port.onmessage=null
      mount(message.data,port)
    }
    port.start();port.postMessage({op:'parent-ready'})
  }
  function mount(data:any,port:MessagePort):void {
    for(const javascript of data.libraries){
      const script=document.createElement('script');script.textContent=javascript;document.head.appendChild(script)
    }
    const message=document.createElement('div'),content=document.createElement('div'),frame=document.createElement('iframe')
    message.className='mes';message.setAttribute('mesid',String(data.messageIndex));content.className='mes_text'
    frame.title='作者浏览器内容';frame.sandbox.add('allow-scripts','allow-same-origin')
    frame.style.cssText='display:block;width:100%;height:100vh;border:0'
    const realm=window as any
    // These are the child's finite Tavern SDK objects. No Main object or
    // authenticated fetch function crosses the author origin.
    for(const name of data.sdkGlobals??['getVariables','getAllVariables','getCurrentMessageId','getLastMessageId','getChatMessages','setChatMessages',
      'waitGlobalInitialized','getTavernRegexes','updateVariablesWith','replaceVariables','insertOrAssignVariables','insertVariables','deleteVariable',
      'triggerSlash','eventOn','eventOnce','eventMakeFirst','eventMakeLast','eventRemoveListener',
      'eventEmit','eventEmitAndWait','errorCatched','SillyTavern','Mvu'])
      Object.defineProperty(realm,name,{configurable:true,get:()=>(frame.contentWindow as any)?.[name]})
    frame.addEventListener('load',()=>frame.contentWindow!.postMessage({op:'connect',channel},location.origin,[port]),{once:true})
    frame.srcdoc=data.html
    content.appendChild(frame);message.appendChild(content);document.body.appendChild(message)
  }
  addEventListener('message',connect)
}

/** Public static bytes only. Source HTML, snapshots and bridge ports arrive
 * from Main after the browser has entered its credentialless partition. */
export const READER_NATIVE_PARENT_SHELL_HTML='<!doctype html><meta charset="utf-8">'
  +'<meta http-equiv="Content-Security-Policy" content="'+READER_NATIVE_RESOURCE_CSP+'">'
  +'<meta name="referrer" content="no-referrer"><style>html,body{margin:0}iframe{border:0}</style>'
  +'<body><script>('+readerNativeParentBootstrap.toString()+')()</script></body>'
