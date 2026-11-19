import {createAuthorDomControls} from './author-dom-controls.js'

/** Browser policy for Source-owned native pages. The credentialless parent
 * supplies an ephemeral network partition before private DATA is delivered. */
export const READER_NATIVE_RESOURCE_CSP="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' http: https: blob:; "
  +"style-src 'unsafe-inline' http: https:; img-src http: https: data: blob:; font-src http: https: data:; "
  +"media-src http: https: data: blob:; connect-src http: https:; frame-src http: https: about: data: blob:; "
  +"base-uri http: https:; form-action 'none'"

/** This static shell is served from an origin unique to one Reader permission
 * group. Its child shares that origin, while Main retains every Core port. */
function readerNativeParentBootstrap(createControls:typeof createAuthorDomControls):void {
  const channel=new URLSearchParams(location.hash.slice(1)).get('channel')
  const connect=(event:MessageEvent)=>{
    if(!['connect-parent','connect-scene'].includes(event.data?.op)||event.data.channel!==channel||!event.ports[0])return
    removeEventListener('message',connect)
    const port=event.ports[0]
    if((window as any).credentialless!==true){
      port.postMessage({op:'parent-error',code:'READER_NATIVE_CREDENTIALLESS_UNAVAILABLE'});port.close();return
    }
    if(event.data.op==='connect-scene'){scene(port);return}
    port.onmessage=message=>{
      if(message.data.op!=='mount'&&message.data.op!=='mount-reader')return
      port.onmessage=null
      mount(message.data,port,channel!)
    }
    port.start();port.postMessage({op:'parent-ready',sourceDataProtocol:1})
  }
  function scene(control:MessagePort):void {
    document.body.style.isolation='isolate'
    const children=new Map<string,{node:HTMLElement;frame:HTMLElement;port?:MessagePort}>()
    const pending=new Map<string,MessagePort>()
    const libraries=new Set<string>()
    const domControls=createControls(rows=>control.postMessage({op:'scene-controls',controls:rows}))
    const helperFrames=new Map<string,HTMLIFrameElement>()
    Object.defineProperty(window,'SillyTavern',{configurable:true,get:()=>{
      for(const frame of helperFrames.values()){
        const facade=(frame.contentWindow as any)?.SillyTavern
        if(facade)return facade
      }
    }})
    const releaseChild=(id:string)=>{
      domControls.releaseFrame(id)
      const child=children.get(id)
      helperFrames.delete(id)
      child?.port?.close();child?.node.remove();children.delete(id)
    }
    addEventListener('pagehide',domControls.dispose,{once:true})
    control.onmessage=event=>{
      const data=event.data
      if(data.op==='scene-control-activate'){
        const code=domControls.activate(data.controlId)
        control.postMessage({op:'scene-control-result',id:data.id,...(code?{code}:{})})
      }else if(data.op==='scene-dispose'){
        domControls.dispose();control.close()
      }else if(data.op==='scene-attach'){
        const bridge=event.ports[0]
        if(!bridge)return
        pending.set(data.id,bridge)
        bridge.onmessage=message=>{
          if(pending.get(data.id)!==bridge)return
          if(message.data.op!=='mount'&&message.data.op!=='mount-reader')return
          bridge.onmessage=null;pending.delete(data.id)
          const payload=message.data
          const fresh=(payload.libraries??[]).filter((javascript:string)=>!libraries.has(javascript))
          for(const javascript of fresh)libraries.add(javascript)
          const helper=data.kind==='helper',background=data.kind==='background'
          const mounted=mount({...payload,libraries:fresh,sdkGlobals:[],helper,background},bridge,data.channel,
            background?undefined:frame=>domControls.watchFrame(data.id,frame))
          // The shared context follows the session's Helper. Reader children
          // retain their own message-scoped APIs.
          if(helper)helperFrames.set(data.id,mounted.frame)
          mounted.node.dataset.authorSceneChild=data.id
          if(!background)mounted.node.style.visibility='hidden'
          if(background)mounted.node.style.zIndex='-1'
          else if(data.kind==='reader')mounted.node.style.zIndex='1'
          children.set(data.id,{...mounted,port:bridge})
          control.postMessage({op:'scene-attached',id:data.id})
        }
        bridge.start();bridge.postMessage({op:'parent-ready',sourceDataProtocol:1})
      }else if(data.op==='scene-external'){
        const bridge=event.ports[0]
        if(!bridge)return
        domControls.releaseFrame(data.id)
        const frame=document.createElement('iframe')
        frame.setAttribute('credentialless','');frame.sandbox.add('allow-scripts','allow-same-origin')
        frame.referrerPolicy='no-referrer';frame.style.cssText='display:block;position:absolute;border:0;width:100%;height:1px'
        frame.style.zIndex=data.kind==='background'?'-1':'1'
        frame.style.visibility='hidden'
        if(data.kind==='background')frame.dataset.authorSceneBackground='true'
        const url=new URL(data.url);url.hash=new URLSearchParams({channel:data.channel}).toString()
        frame.addEventListener('load',()=>frame.contentWindow!.postMessage({op:'connect-parent',channel:data.channel},url.origin,[bridge]),{once:true})
        frame.src=url.href;document.body.append(frame);children.set(data.id,{node:frame,frame,port:bridge})
        control.postMessage({op:'scene-attached',id:data.id})
      }else if(data.op==='scene-error'){
        releaseChild(data.id)
        const node=document.createElement('p');node.setAttribute('role','alert')
        node.textContent='作者文档不可用：'+data.code+'。请修复失败文档后刷新视图。'
        node.style.cssText='position:absolute;margin:0;z-index:1'
        node.style.visibility='hidden'
        document.body.append(node);children.set(data.id,{node,frame:node})
        control.postMessage({op:'scene-attached',id:data.id})
      }else if(data.op==='scene-box'){
        const child=children.get(data.id)
        if(!child)return
        child.node.style.visibility=data.box?'visible':'hidden'
        if(!data.box)return
        const {top,left,width,height}=data.box
        child.node.style.position='absolute';child.node.style.top=top+'px';child.node.style.left=left+'px'
        child.node.style.width=child.node.dataset.authorSceneBackground?'100%':width+'px'
        if(!child.node.dataset.authorSceneChild)child.frame.style.height=height+'px'
      }else if(data.op==='scene-size'){
        const child=children.get(data.childId)
        if(child)child.frame.style.height=Math.ceil(data.height)+'px'
        requestAnimationFrame(()=>control.postMessage({op:'scene-sized',id:data.id}))
      }else if(data.op==='scene-remove'){
        const waiting=pending.get(data.id)
        if(waiting){waiting.onmessage=null;waiting.close();pending.delete(data.id)}
        releaseChild(data.id)
      }else if(data.op==='scene-height')document.body.style.minHeight=data.height+'px'
    }
    control.start();control.postMessage({op:'scene-ready',sourceDataProtocol:1})
  }
  function mount(data:any,port:MessagePort,childChannel:string,observeFrame?:(frame:HTMLIFrameElement)=>void)
    :{node:HTMLElement;frame:HTMLIFrameElement} {
    for(const javascript of data.libraries){
      const script=document.createElement('script');script.textContent=javascript;document.head.appendChild(script)
    }
    const message=document.createElement('div'),content=document.createElement('div'),frame=document.createElement('iframe')
    message.className='mes';message.setAttribute('mesid',String(data.messageIndex));content.className='mes_text'
    frame.title='作者浏览器内容';frame.sandbox.add('allow-scripts','allow-same-origin')
    frame.style.cssText='display:block;width:100%;height:100vh;border:0'
    observeFrame?.(frame)
    const realm=window as any
    // These are the child's finite Tavern SDK objects. No Main object or
    // authenticated fetch function crosses the author origin.
    for(const name of data.sdkGlobals??['getVariables','getAllVariables','getCurrentMessageId','getLastMessageId','getChatMessages','setChatMessages',
      'waitGlobalInitialized','getTavernRegexes','formatAsTavernRegexedString',
      'updateVariablesWith','replaceVariables','insertOrAssignVariables','insertVariables','deleteVariable',
      'triggerSlash','generate','generateRaw','stopGenerationById','stopAllGeneration','iframe_events','tavern_events','event_types',
      'placeholder_prompt_default_order','builtin_prompt_default_order',
      'eventOn','eventOnce','eventMakeFirst','eventMakeLast','eventRemoveListener',
      'eventClearEvent','eventClearListener','eventClearAll','eventEmit','eventEmitAndWait',
      'getPresetNames','getLoadedPresetName','getPreset','getWorldbookNames','getCurrentCharPrimaryLorebook','getWorldbook',
      'getGlobalWorldbookNames','getCharWorldbookNames','getChatWorldbookName',
      'errorCatched','SillyTavern','Mvu'])
      Object.defineProperty(realm,name,{configurable:true,get:()=>(frame.contentWindow as any)?.[name]})
    frame.addEventListener('load',()=>frame.contentWindow!.postMessage({op:'connect',channel:childChannel},location.origin,[port]),{once:true})
    frame.srcdoc=data.html
    if(data.background){
      const background=document.createElement('div');background.dataset.authorSceneBackground='true'
      background.style.cssText='position:absolute;top:0;left:0;width:100%'
      frame.style.display='none';background.append(frame);document.body.append(background)
      return {node:background,frame}
    }
    if(data.helper){frame.hidden=true;frame.style.display='none';document.body.appendChild(frame);return {node:frame,frame}}
    content.appendChild(frame);message.appendChild(content);document.body.appendChild(message)
    return {node:message,frame}
  }
  addEventListener('message',connect)
}

/** Public static bytes only. Source HTML, snapshots and bridge ports arrive
 * from Main after the browser has entered its credentialless partition. */
export const READER_NATIVE_PARENT_SHELL_HTML='<!doctype html><meta charset="utf-8">'
  +'<meta http-equiv="Content-Security-Policy" content="'+READER_NATIVE_RESOURCE_CSP+'">'
  +'<meta name="referrer" content="no-referrer"><style>html,body{margin:0}iframe{border:0}</style>'
  +'<body><script>('+readerNativeParentBootstrap.toString()+')('+createAuthorDomControls.toString()+')</script></body>'
