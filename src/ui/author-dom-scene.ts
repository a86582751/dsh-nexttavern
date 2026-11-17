import type {AuthorNativeSceneV1} from '../core/author-native-helper-types.js'

export interface AuthorDomSceneChild {
  resize(height:number):Promise<void>
  box(value:{top:number;left:number;width:number;height:number}):void
  dispose():void
}
export interface AuthorDomScene {
  readonly identity:string
  readonly parentOrigin:string
  readonly frame:HTMLIFrameElement
  mount(value:{id:string;kind:'reader'|'helper'|'background';channel:string;port:MessagePort;url?:string}):AuthorDomSceneChild
  height(value:number):void
  position(id:string,value?:{top:number;left:number;width:number;height:number}):void
  error(id:string,code:string):void
  remove(id:string):void
  dispose():void
}

/** The current UI attachment owns the browser partition. Core supplies its
 * grouping identity, while every child retains its independent business port. */
export function createAuthorDomScene(container:HTMLElement,source:AuthorNativeSceneV1,
  failed:(code:string)=>void):AuthorDomScene {
  const view=container.ownerDocument.defaultView!,frame=container.ownerDocument.createElement('iframe')
  const channel=crypto.randomUUID(),ports=new view.MessageChannel()
  let active=true,ready=false
  let failureCode:string|undefined
  const pending=new Map<string,{message:object;port:MessagePort}>()
  const boxes=new Map<string,{top:number;left:number;width:number;height:number}|undefined>()
  let height=1
  let sequence=0
  const sizes=new Map<number,{childId:string;resolve():void;reject(error:Error):void}>()
  const cancelSizes=(code:string,childId?:string)=>{
    for(const [id,size] of sizes){
      if(childId!==undefined&&size.childId!==childId)continue
      sizes.delete(id);size.reject(Error(code))
    }
  }
  frame.title='作者共享阅读场景';frame.sandbox.add('allow-scripts','allow-same-origin')
  frame.setAttribute('credentialless','');frame.referrerPolicy='no-referrer'
  frame.style.cssText='display:block;position:relative;width:100%;height:1px;border:0'
  const send=(value:object)=>{if(active&&ready)ports.port1.postMessage(value)}
  const attach=(id:string)=>{
    const child=pending.get(id)
    if(!active||!ready||!child)return
    pending.delete(id);ports.port1.postMessage(child.message,[child.port])
  }
  const fail=(code:string)=>{
    failureCode=code
    cancelSizes(code)
    for(const child of pending.values()){child.port.postMessage({op:'parent-error',code});child.port.close()}
    pending.clear();failed(code)
  }
  const timeout=view.setTimeout(()=>{if(active&&!ready)fail('AUTHOR_SCENE_STARTUP_UNAVAILABLE')},15000)
  ports.port1.onmessage=event=>{
    if(!active)return
    const data=event.data
    if(data.op==='scene-ready'){
      ready=true;view.clearTimeout(timeout)
      for(const id of pending.keys())attach(id)
      send({op:'scene-height',height})
    }else if(data.op==='scene-attached'){
      const box=boxes.get(data.id)
      if(boxes.has(data.id))send({op:'scene-box',id:data.id,box})
    }else if(data.op==='scene-sized'){sizes.get(data.id)?.resolve();sizes.delete(data.id)}
    else if(data.op==='parent-error')fail(data.code)
  }
  ports.port1.start()
  const url=new URL(source.parentOrigin);url.hash=new URLSearchParams({channel}).toString()
  frame.addEventListener('load',()=>{if(active)frame.contentWindow!.postMessage({op:'connect-scene',channel},url.origin,[ports.port2])},{once:true})
  frame.src=url.href;container.append(frame)
  return {identity:source.identity,parentOrigin:source.parentOrigin,frame,
    mount(value){
      const {port,...data}=value
      if(failureCode){port.postMessage({op:'parent-error',code:failureCode});port.close()}
      else {pending.set(value.id,{message:{...data,op:value.url?'scene-external':'scene-attach'},port});attach(value.id)}
      let live=true
      return {resize(height){return new Promise<void>((resolve,reject)=>{
        const id=++sequence;sizes.set(id,{childId:value.id,resolve,reject});send({op:'scene-size',childId:value.id,id,height})
      })},box(box){if(live){boxes.set(value.id,box);send({op:'scene-box',id:value.id,box})}},
        dispose(){if(!live)return;live=false
          cancelSizes('AUTHOR_SCENE_CHILD_REVOKED',value.id)
          pending.get(value.id)?.port.close();pending.delete(value.id)
          send({op:'scene-remove',id:value.id})}}
    },
    height(value){height=value;frame.style.height=Math.max(1,value)+'px';send({op:'scene-height',height:value})},
    position(id,box){boxes.set(id,box);send({op:'scene-box',id,box})},
    error(id,code){send({op:'scene-error',id,code})},
    remove(id){cancelSizes('AUTHOR_SCENE_CHILD_REVOKED',id);boxes.delete(id);send({op:'scene-remove',id})},
    dispose(){if(!active)return;active=false;view.clearTimeout(timeout)
      cancelSizes('AUTHOR_SCENE_REVOKED')
      for(const child of pending.values())child.port.close()
      pending.clear();boxes.clear();ports.port1.close();ports.port2.close();frame.remove()},
  }
}
