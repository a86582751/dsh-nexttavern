import {READER_NATIVE_RESOURCE_CSP} from '../core/reader-native-parent-realm.js'
import type {ReaderNativeBeautyExecutionV1,ReaderNativeBeautyLayoutV1} from '../core/reader-native-beauty-types.js'
import type {ReaderRegexDocumentRenderV1} from '../core/reader-regex-document-types.mjs'
import type {AuthorDomScene,AuthorDomSceneChild} from './author-dom-scene.js'

/** The published Native beauty API is a function body receiving root/fill.
 * It is separate from TavernHelper module descriptors and has no Core port. */
export function readerNativeBeautyBootstrap(channel:string,sharedDom=false):void {
  let port:MessagePort|undefined,revision=0,active=true,started=false,measuredHeight=0
  let layoutFrame:number|undefined,layoutTimer:number|undefined
  let cleanup:(()=>void)|undefined
  // The default Reader body belongs to the author scene. Helper scripts can
  // find and bind its real nodes using the same parent-document API as upstream.
  const readerDocument=sharedDom?parent.document:document
  const readerWindow=readerDocument.defaultView!
  const host=sharedDom?frameElement!.parentElement!:readerDocument.body
  const root=readerDocument.createElement('div'),sheet=readerDocument.createElement('style')
  root.className='rp-reader';const viewport=readerDocument.createElement('div');viewport.className='rp-reader-view'
  viewport.append(root);host.append(sheet,viewport)
  const rows=new Map<string,{node:HTMLElement;actions:HTMLElement;content:string}>()
  const documents=new Map<string,HTMLElement>(),staticViews:{dispose():void}[]=[]
  let actionHeights:Readonly<Record<string,number>>={},documentHeights:Readonly<Record<string,number>>={}
  const send=(value:object)=>{if(active)port?.postMessage(value)}
  const cancelMeasure=()=>{
    if(layoutFrame!==undefined)readerWindow.cancelAnimationFrame(layoutFrame)
    readerWindow.clearTimeout(layoutTimer)
    layoutFrame=undefined;layoutTimer=undefined
  }
  const measure=()=>{
    cancelMeasure();if(!active)return
    const origin=root.getBoundingClientRect(),body=host.getBoundingClientRect()
    const box=(node:HTMLElement)=>{const rect=node.getBoundingClientRect()
      return {top:rect.top-body.top,left:rect.left-body.left,width:rect.width}}
    const present=(node:HTMLElement)=>{
      if(!root.isConnected||!root.contains(node))return false
      const style=readerWindow.getComputedStyle(node)
      return style.display!=='none'&&style.visibility==='visible'&&node.getClientRects().length>0
    }
    const rowBoxes=Object.fromEntries([...rows].filter(([,row])=>present(row.actions)).map(([key,row])=>[key,box(row.actions)]))
    const documentBoxes=Object.fromEntries([...documents].filter(([,node])=>present(node)).map(([key,node])=>[key,box(node)]))
    measuredHeight=Math.ceil(Math.max(origin.bottom-body.top,...Array.from(host.children,
      node=>node.getBoundingClientRect().bottom-body.top),0))
    send({op:'layout',value:{revision,height:measuredHeight,rows:rowBoxes,documents:documentBoxes}})
  }
  const schedule=()=>{
    if(!active||layoutFrame!==undefined)return
    layoutFrame=readerWindow.requestAnimationFrame(measure)
    // Offscreen author frames can receive slot updates without a paint.
    layoutTimer=readerWindow.setTimeout(measure,100)
  }
  const layoutAfterUpdate=()=>{
    if(measuredHeight>1){schedule();return}
    // A clipped or still-empty Reader can receive content before Chromium
    // resumes animation frames inside the author scene.
    mutation.takeRecords()
    measure()
  }
  const fill=(value:unknown)=>send({op:'fill',text:String(value??'')})
  const fillClick=(event:Event)=>{
    const target=event.target as Element|null,button=target?.closest<HTMLElement>('[data-community-option],.f')
    if(button){event.preventDefault();fill(button.dataset.communityOption??button.innerText??button.textContent??'')}
  }
  root.addEventListener('click',fillClick)
  const resize=new readerWindow.ResizeObserver(schedule);resize.observe(root)
  const mutation=new readerWindow.MutationObserver(schedule)
  mutation.observe(root,{childList:true,subtree:true,attributes:true,characterData:true})
  const resizeSlots=()=>{
    for(const [key,row] of rows)row.actions.style.height=(actionHeights[key]??0)+'px'
    for(const [key,node] of documents)node.style.height=(documentHeights[key]??1)+'px'
  }
  function staticDocument(html:string):HTMLIFrameElement {
    const frame=readerDocument.createElement('iframe');frame.sandbox.add('allow-same-origin')
    frame.style.cssText='width:100%;height:1px;border:0;display:block'
    let observer:ResizeObserver|undefined
    const loaded=()=>{
      const doc=frame.contentDocument!,extent=()=>{
        frame.style.height=Math.max(1,Math.ceil(doc.body.getBoundingClientRect().height))+'px';schedule()
      }
      doc.addEventListener('click',event=>{fillClick(event);if((event.target as Element)?.closest('a'))event.preventDefault()})
      doc.addEventListener('submit',event=>event.preventDefault())
      observer=new readerWindow.ResizeObserver(extent);observer.observe(doc.body);extent()
    }
    frame.addEventListener('load',loaded,{once:true})
    frame.srcdoc='<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; '
      +'script-src \'none\'; style-src \'unsafe-inline\' https:; img-src data: blob: https:; font-src data: https:">'
      +'<style>body{margin:0;display:flow-root}</style>'+html
    staticViews.push({dispose(){observer?.disconnect();frame.removeEventListener('load',loaded)}})
    return frame
  }
  const render=(value:ReaderRegexDocumentRenderV1)=>{
    revision=value.renderRevision
    const css=value.css+(sharedDom?'':'\nhtml,body{margin:0;overflow:hidden}')
      // Fit the themed padding inside the frame, and keep paragraph margins
      // inside the box we report to the outer Reader.
      +'.rp-reader-view{width:100%;box-sizing:border-box;min-height:0;overflow:visible;display:flow-root}'
      +'.rp-reader{width:100%;max-width:none}'
    if(sheet.textContent!==css)sheet.textContent=css
    const next=new Set(value.parts.map(part=>part.key))
    for(const [key,row] of rows)if(!next.has(key)){resize.unobserve(row.node);row.node.remove();rows.delete(key)}
    documents.clear()
    let cursor=root.firstChild
    for(const part of value.parts){
      const content=JSON.stringify(part),previous=rows.get(part.key)
      let row=previous
      if(!row||row.content!==content){
        const node=readerDocument.createElement('section'),actions=readerDocument.createElement('div')
        node.className='rp-reader-message';node.dataset.readerKey=part.key;node.dataset.kind=part.kind==='user'?'user':'assistant'
        actions.className='rp-reader-action-space';actions.setAttribute('aria-hidden','true')
        const body=readerDocument.createElement('text' in part?'p':'div')
        body.className=part.kind==='user'?'rp-user-line':'rp-reader-narrative'
        if('text' in part)body.textContent='◈ 你：'+part.text
        else if(part.fragments)for(const fragment of part.fragments){
          const slot=readerDocument.createElement('div')
          if(fragment.kind==='reader-document'){slot.dataset.readerNativeDocument=fragment.documentPlanSha256}
          else if(fragment.kind==='static-document')slot.append(staticDocument(fragment.html))
          else if(fragment.kind==='failed-document'||fragment.kind==='pending-document')slot.textContent='作者文档不可用：'+fragment.code
          else slot.innerHTML=fragment.html
          body.append(slot)
        }else body.innerHTML=part.html
        node.append(body,actions)
        if(previous){resize.unobserve(previous.node);previous.node.replaceWith(node);if(cursor===previous.node)cursor=node}
        row={node,actions,content};rows.set(part.key,row);resize.observe(node)
      }
      if(row.node!==cursor)root.insertBefore(row.node,cursor)
      cursor=row.node.nextSibling
      // Only our finite document placeholders are joined to Main containers.
      for(const slot of row.node.querySelectorAll<HTMLElement>('[data-reader-native-document]'))
        documents.set(slot.dataset.readerNativeDocument!,slot)
    }
    resizeSlots()
  }
  const finish=()=>{if(!active)return;active=false;cancelMeasure();resize.disconnect();mutation.disconnect()
    for(const view of staticViews)view.dispose()
    try{cleanup?.()}finally{cleanup=undefined;viewport.remove();sheet.remove();port?.close()}}
  const connect=(event:MessageEvent)=>{
    if(port||event.data?.op!=='connect'||event.data.channel!==channel||!event.ports[0])return
    port=event.ports[0];removeEventListener('message',connect)
    port.onmessage=event=>{
      const data=event.data
      if(data.op==='render'){
        actionHeights=data.actionHeights;documentHeights=data.documentHeights;render(data.render)
        if(!started){started=true
          try{const result=data.source?new Function('root','fill',data.source.javascript).call(window,root,fill):undefined
            if(typeof result==='function')cleanup=result
          }catch(error){send({op:'source-error',code:error instanceof Error?error.message:String(error)})}
        }
        layoutAfterUpdate()
      }else if(data.op==='slots'){
        actionHeights=data.actionHeights;documentHeights=data.documentHeights;resizeSlots();layoutAfterUpdate()
      }
    };port.start();send({op:'ready'})
  }
  addEventListener('message',connect);addEventListener('pagehide',finish,{once:true});addEventListener('unload',finish,{once:true})
}

const html=(channel:string,sharedDom:boolean)=>'<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="'
  +READER_NATIVE_RESOURCE_CSP+'"><meta name="referrer" content="no-referrer"><body><script>('
  +readerNativeBeautyBootstrap.toString()+')('+JSON.stringify(channel)+','+sharedDom+')</script></body>'

export function createReaderNativeBeautyFrame(container:HTMLElement,execution:ReaderNativeBeautyExecutionV1|undefined,options:{
  current():boolean;fill(text:string):void;layout(value:ReaderNativeBeautyLayoutV1):void;failed(code:string):void
  scene?:AuthorDomScene
}) {
  const view=container.ownerDocument.defaultView!
  let active=true,frame:HTMLIFrameElement|undefined,port:MessagePort|undefined,ready=false,runKey=''
  let startupTimer:number|undefined
  let sceneChild:AuthorDomSceneChild|undefined
  let latest:ReaderRegexDocumentRenderV1|undefined,actionHeights:Readonly<Record<string,number>>={},documentHeights:Readonly<Record<string,number>>={}
  const publish=()=>{if(ready&&latest)port!.postMessage({op:'render',render:latest,source:execution?.source,actionHeights,documentHeights})}
  const retire=()=>{view.clearTimeout(startupTimer);ready=false;port?.close();port=undefined;sceneChild?.dispose();sceneChild=undefined;frame?.remove();frame=undefined}
  function mount():void {
    retire();const channel=crypto.randomUUID(),ports=new view.MessageChannel()
    const child=options.scene?undefined:container.ownerDocument.createElement('iframe');frame=child;port=ports.port1
    if(child){
    child.title='作者排版美化';child.style.cssText='display:block;width:100%;height:1px;border:0'
    child.setAttribute('credentialless','');child.sandbox.add('allow-scripts','allow-same-origin')
    }
    const ownPort=ports.port1,current=()=>active&&options.current()&&port===ownPort&&frame===child
    startupTimer=view.setTimeout(()=>{if(current())options.failed('READER_BEAUTY_STARTUP_UNAVAILABLE')},15000)
    ownPort.onmessage=event=>{
      if(!current())return
      const data=event.data
      if(data.op==='parent-ready')ownPort.postMessage({op:'mount',html:html(channel,!!options.scene&&!execution),
        libraries:[],sdkGlobals:[],messageIndex:0})
      else if(data.op==='ready'){ready=true;publish()}
      else if(data.op==='layout'){
        if(data.value.revision!==latest?.renderRevision)return
        view.clearTimeout(startupTimer)
        if(child)child.style.height=Math.max(1,data.value.height)+'px';options.layout(data.value)
        sceneChild?.box({top:0,left:0,width:options.scene!.frame.getBoundingClientRect().width,height:Math.max(1,data.value.height)})
      }else if(data.op==='fill')options.fill(data.text)
      else if(data.op==='source-error'||data.op==='parent-error')options.failed(data.code)
    };ownPort.start()
    if(options.scene){
      sceneChild=options.scene.mount({id:'reader-background',kind:'background',channel,port:ports.port2,
        ...(execution?{url:execution.parentOrigin}:{})})
      sceneChild.box({top:0,left:0,width:options.scene.frame.getBoundingClientRect().width,height:1})
      return
    }
    const parent=new URL(execution!.parentOrigin);parent.hash=new URLSearchParams({channel}).toString()
    child!.addEventListener('load',()=>{if(current())child!.contentWindow!.postMessage({op:'connect-parent',channel},parent.origin,[ports.port2])},{once:true})
    child!.src=parent.href;container.append(child!)
  }
  return {
    render(value:ReaderRegexDocumentRenderV1,key:string){
      latest=value
      if(!port||runKey!==key){runKey=key;mount()}else publish()
    },
    slots(actions:Readonly<Record<string,number>>,documents:Readonly<Record<string,number>>){
      if(actionHeights===actions&&documentHeights===documents)return
      actionHeights=actions;documentHeights=documents
      if(ready)port!.postMessage({op:'slots',actionHeights,documentHeights})
    },
    dispose(){if(!active)return;active=false;retire();latest=undefined},
  }
}
