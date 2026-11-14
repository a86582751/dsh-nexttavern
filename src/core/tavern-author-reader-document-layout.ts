export interface ReaderDocumentLayoutConfig {mode:'auto'|'fit';viewportHeight:number}
export function createReaderDocumentLayoutSettings() {
  let value:ReaderDocumentLayoutConfig={mode:'auto',viewportHeight:600}
  const listeners=new Set<(explicit:boolean)=>void>()
  return {
    get:()=>value,
    set(next:ReaderDocumentLayoutConfig,explicit=false){
      if(!explicit&&next.mode===value.mode&&next.viewportHeight===value.viewportHeight)return
      value=next;for(const listener of listeners)listener(explicit)
    },
    subscribe(listener:(explicit:boolean)=>void){listeners.add(listener);return ()=>{listeners.delete(listener)}},
  }
}
export type ReaderDocumentLayoutSettings=ReturnType<typeof createReaderDocumentLayoutSettings>

/** Self-contained so the same policy runs in a same-origin or opaque document.
 * Only the parent writes frame height. Completion acknowledges an applied viewport. */
export function createReaderDocumentLayoutRealm(document:Document,initial:ReaderDocumentLayoutConfig,
  writeHeight:(height:number)=>Promise<void>,authorSized=false) {
  const view=document.defaultView!,html=document.documentElement
  let config=initial,active=true,blocked=false,authorOwned=authorSized,busy=false,dirty=false
  let task:number|undefined,epoch=0,body:HTMLElement|null=null,lastWidth=0,lastExtent=0
  const original={transform:html.style.transform,origin:html.style.transformOrigin}
  let transformed=false
  function restore(){
    if(!transformed)return
    html.style.transform=original.transform;html.style.transformOrigin=original.origin;transformed=false
  }
  function extent(){
    const node=document.body;if(!node)return 0
    const css=view.getComputedStyle(node)
    return Math.ceil(node.getBoundingClientRect().height+parseFloat(css.marginTop||'0')+parseFloat(css.marginBottom||'0'))
  }
  const nextFrame=()=>new Promise<void>(resolve=>view.requestAnimationFrame(()=>resolve()))
  async function measure(){
    task=undefined
    if(!active||authorOwned||busy)return
    const run=epoch,current=()=>active&&!authorOwned&&epoch===run
    busy=true;dirty=false
    try {
      restore()
      if(config.mode==='fit') {
        await writeHeight(config.viewportHeight);await nextFrame()
        if(!current())return
        const unscaled=extent(),width=Math.max(document.body?.scrollWidth??0,html.clientWidth)
        const ratio=Math.min(1,config.viewportHeight/Math.max(1,unscaled),html.clientWidth/Math.max(1,width))
        html.style.transformOrigin='top left';html.style.transform=`scale(${ratio}) ${original.transform}`.trim();transformed=true
      }else if(blocked) {
        // Our own viewport's body RO never unlocks sticky feedback fallback.
        return
      }else {
        const candidate=Math.max(1,extent())
        if(Math.abs(candidate-view.innerHeight)>=1) {
          await writeHeight(candidate);await nextFrame()
          if(!current())return
          if(Math.abs(extent()-candidate)>1){blocked=true;await writeHeight(config.viewportHeight);await nextFrame()}
        }
      }
      if(current()){lastExtent=extent();lastWidth=html.clientWidth}
    }catch {if(current())authorOwned=true}
    finally {busy=false;if(dirty)schedule()}
  }
  function schedule(){
    if(!active||authorOwned)return
    if(busy){dirty=true;return}
    if(task===undefined)task=view.requestAnimationFrame(()=>{void measure()})
  }
  const bodyResize=new view.ResizeObserver(()=>{
    if(busy)return
    if(html.clientWidth!==lastWidth||Math.abs(extent()-lastExtent)>1)schedule()
  })
  function observeBody(){
    if(body===document.body)return
    if(body)bodyResize.unobserve(body)
    body=document.body;if(body)bodyResize.observe(body)
    schedule()
  }
  const mutation=new view.MutationObserver(records=>{
    if(records.every(record=>record.target===html&&record.type==='attributes'&&record.attributeName==='style'))return
    // A Source mutation during the height ACK changes the measured content.
    // Retire that sample before judging viewport feedback against its old size.
    epoch++
    observeBody();schedule()
  })
  mutation.observe(document,{childList:true,subtree:true,characterData:true,attributes:true,
    attributeFilter:['class','style','src','width','height']})
  const loaded=()=>schedule()
  document.addEventListener('load',loaded,true);view.addEventListener('resize',loaded)
  void document.fonts?.ready.then(()=>{if(active)schedule()})
  document.fonts?.addEventListener('loadingdone',loaded)
  observeBody();schedule()
  return {
    update(next:ReaderDocumentLayoutConfig,explicit=false){
      const previous=config;config=next;epoch++
      if(explicit){blocked=false;authorOwned=false}
      if(blocked&&!authorOwned&&previous.viewportHeight!==next.viewportHeight)
        void writeHeight(next.viewportHeight).catch(()=>{})
      schedule()
    },
    pause(){authorOwned=true;epoch++;restore()},
    dispose(){
      active=false;epoch++;if(task!==undefined)view.cancelAnimationFrame(task)
      mutation.disconnect();bodyResize.disconnect()
      document.removeEventListener('load',loaded,true);view.removeEventListener('resize',loaded)
      document.fonts?.removeEventListener('loadingdone',loaded);restore()
    },
  }
}

/** Same-origin adapter; the shared policy has no parent DOM capability. */
export function createReaderDocumentLayout({frame,document,settings,authorSized=false}:{frame:HTMLIFrameElement;
  document:Document;settings:ReaderDocumentLayoutSettings;authorSized?:boolean}) {
  const scheduler=frame.ownerDocument.defaultView!
  let active=true,ownHeight=frame.style.height,lastWidth=frame.getBoundingClientRect().width
  const policy=createReaderDocumentLayoutRealm(document,settings.get(),async value=>{
    if(!active)throw Error('READER_DOCUMENT_LAYOUT_CLOSED')
    ownHeight=`${Math.ceil(value)}px`;frame.style.height=ownHeight
  },authorSized)
  const frameMutation=new scheduler.MutationObserver(records=>{
    if(records.some(record=>record.attributeName==='height')||frame.style.height!==ownHeight){policy.pause();return}
    const width=frame.getBoundingClientRect().width
    if(width!==lastWidth){lastWidth=width;policy.update(settings.get())}
  })
  frameMutation.observe(frame,{attributes:true,attributeFilter:['style','height']})
  const unsubscribe=settings.subscribe(explicit=>policy.update(settings.get(),explicit))
  return {pause:policy.pause,dispose(){active=false;unsubscribe();frameMutation.disconnect();policy.dispose()}}
}
