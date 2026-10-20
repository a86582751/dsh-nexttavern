/** Main owns one Reader document and its rows. Actor-local scenes only borrow
 * its actual document and plan containers; they never own this surface. */
import {BROWSER_NATIVE_INERT_SHELL_V3} from './tavern-author-browser-frame-native-v3.js'
import type {BrowserRenderV1} from './tavern-author-browser-types.mjs'
import type {ReaderRegexDocumentRenderV1} from './reader-regex-document-types.mjs'

export type AuthorReaderSurfaceRender=BrowserRenderV1|ReaderRegexDocumentRenderV1
export interface AuthorReaderSurfaceLayout {
  readonly height:number
  readonly renderRevision:number
  readonly rows:Readonly<Record<string,{top:number;left:number;width:number}>>
}
export interface AuthorReaderSurface {
  readonly outer:HTMLIFrameElement
  readonly ready:Promise<Document>
  render(value:AuthorReaderSurfaceRender):void
  /** True while callers must wait for the next surface layout receipt. */
  setActionHeights(value:Readonly<Record<string,number>>):boolean
  documentContainer(planSha256:string):HTMLElement
  scheduleLayout():void
  dispose():void
}
interface Options {
  current():boolean
  layout(value:AuthorReaderSurfaceLayout):void
  mountStaticDocument?:(container:HTMLElement,html:string,layout:()=>void)=>{dispose():void}
}
interface Row {
  readonly node:HTMLElement
  readonly actions:HTMLElement
  kind:'user'|'narrator'
  content:string
  staticDocuments:{dispose():void}[]
  documentPlans:string[]
}

export function createAuthorReaderSurface(outer:HTMLIFrameElement,options:Options):AuthorReaderSurface {
  const view=outer.ownerDocument.defaultView!,rows=new Map<string,Row>(),containers=new Map<string,HTMLElement>()
  let active=true,document:Document|undefined,root:HTMLElement|undefined,style:HTMLStyleElement|undefined
  let pending:AuthorReaderSurfaceRender|undefined,renderRevision=0,layoutFrame:number|undefined
  let actionHeights:Readonly<Record<string,number>>={}
  let resize:ResizeObserver|undefined,mutation:MutationObserver|undefined
  let resolveReady!:(document:Document)=>void,rejectReady!:(error:Error)=>void
  const ready=new Promise<Document>((resolve,reject)=>{resolveReady=resolve;rejectReady=reject})
  // The view may close before an Actor begins awaiting its document.
  void ready.catch(()=>{})
  const current=()=>active&&options.current()
  function scheduleLayout():void {
    if(!current()||layoutFrame!==undefined)return
    layoutFrame=view.requestAnimationFrame(()=>{
      layoutFrame=undefined
      if(!current()||!document)return
      const body=document.body,bounds=body.getBoundingClientRect(),top=bounds.top
      // Content bounds can shrink; body.scrollHeight retains the old viewport.
      const height=Math.ceil(Array.from(body.children).reduce((height,element)=>
        Math.max(height,element.getBoundingClientRect().bottom-top),0))
      const positions=Object.fromEntries(Array.from(rows,([key,row])=>{
        const slot=row.actions.getBoundingClientRect()
        return [key,{top:slot.top-top,left:slot.left-bounds.left,width:slot.width}]
      }))
      outer.style.height=height+'px';options.layout({height,renderRevision,rows:positions})
    })
  }
  function releaseRow(row:Row):void {
    for(const child of row.staticDocuments)child.dispose()
    for(const plan of row.documentPlans)containers.delete(plan)
    row.staticDocuments=[];row.documentPlans=[]
  }
  function render(value:AuthorReaderSurfaceRender):void {
    if(!current())return
    if(!root||!style||!document){pending=value;return}
    renderRevision=value.renderRevision
    const css=value.css+'\nhtml,body{margin:0;overflow:hidden}'+
      '.rp-reader-view{min-height:0;overflow:visible;display:block}'
    if(style.textContent!==css)style.textContent=css
    const next=new Set(value.parts.map(part=>part.key))
    for(const [key,row] of rows)if(!next.has(key)) {
      releaseRow(row);row.node.remove();rows.delete(key)
    }
    let cursor=root.firstChild
    for(const part of value.parts) {
      const fragments=part.kind==='narrator'&&'fragments' in part?part.fragments:undefined
      const content=part.kind==='user'?part.text:fragments?JSON.stringify(fragments):part.html
      let row=rows.get(part.key)
      if(!row) {
        const node=document.createElement('section')
        node.className='rp-reader-message';node.dataset.readerKey=part.key
        const actions=document.createElement('div')
        actions.className='rp-reader-action-space';actions.setAttribute('aria-hidden','true')
        actions.style.height=(actionHeights[part.key]??0)+'px'
        row={node,actions,kind:part.kind,content:'',staticDocuments:[],documentPlans:[]};rows.set(part.key,row)
      }
      if(!row.node.firstChild||row.kind!==part.kind||row.content!==content) {
        releaseRow(row)
        const body=document.createElement(part.kind==='user'?'p':'div')
        body.className=part.kind==='user'?'rp-user-line':'rp-reader-narrative'
        if(part.kind==='user')body.textContent='◈ 你：'+part.text
        else if(fragments)for(const fragment of fragments) {
          const node=document.createElement('div')
          if(fragment.kind==='text')node.innerHTML=fragment.html
          else if(fragment.kind==='static-document')
            row.staticDocuments.push(options.mountStaticDocument!(node,fragment.html,scheduleLayout))
          else {
            node.dataset.readerRegexDocument=fragment.documentPlanSha256
            containers.set(fragment.documentPlanSha256,node);row.documentPlans.push(fragment.documentPlanSha256)
          }
          body.appendChild(node)
        }
        else body.innerHTML=part.html
        row.node.replaceChildren(body,row.actions);row.node.dataset.kind=part.kind==='user'?'user':'assistant'
        row.kind=part.kind;row.content=content
      }
      // Keep unchanged media and Source documents in place across captures.
      if(row.node!==cursor)root.insertBefore(row.node,cursor)
      cursor=row.node.nextSibling
    }
    scheduleLayout()
  }
  function loaded():void {
    if(!current()||document)return
    document=outer.contentDocument!
    document.open();document.write(BROWSER_NATIVE_INERT_SHELL_V3);document.close()
    style=document.createElement('style');document.head.append(style)
    const viewport=document.createElement('div');viewport.className='rp-reader-view'
    root=document.createElement('div');root.className='rp-reader'
    viewport.append(root);document.body.append(viewport)
    resize=new view.ResizeObserver(scheduleLayout);resize.observe(document.body)
    mutation=new view.MutationObserver(scheduleLayout)
    mutation.observe(document.body,{childList:true,subtree:true,attributes:true,characterData:true})
    if(pending){const value=pending;pending=undefined;render(value)}
    resolveReady(document)
  }
  outer.setAttribute('sandbox','allow-same-origin allow-forms')
  outer.style.cssText='display:block;width:100%;height:620px;border:0'
  outer.addEventListener('load',loaded);outer.src='about:blank'
  return {outer,ready,render,scheduleLayout,setActionHeights(value) {
    const previous=actionHeights
    actionHeights=value
    let changed=false
    for(const [key,row] of rows) {
      const height=value[key]??0
      // Only a changed toolbar height needs another document layout. Measuring
      // the same React row again must not create a resize/render feedback loop.
      // CSSOM rounds fractional pixel strings; compare Main's owned numbers.
      if((previous[key]??0)!==height){row.actions.style.height=height+'px';changed=true}
    }
    if(changed)scheduleLayout()
    return layoutFrame!==undefined
  },documentContainer:plan=>containers.get(plan)!,dispose() {
    if(!active)return
    active=false;outer.removeEventListener('load',loaded)
    resize?.disconnect();mutation?.disconnect()
    if(layoutFrame!==undefined)view.cancelAnimationFrame(layoutFrame)
    for(const row of rows.values())releaseRow(row)
    rows.clear();containers.clear();pending=undefined
    rejectReady(Error('READER_SURFACE_CLOSED'))
    outer.removeAttribute('src');outer.removeAttribute('srcdoc')
  }}
}
