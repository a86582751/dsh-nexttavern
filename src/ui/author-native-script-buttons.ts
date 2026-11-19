import type {AuthorNativeScriptV1} from '../core/author-native-program.mjs'
import type {AuthorNativeScriptButtonsSnapshotV1} from '../core/author-native-helper-types.js'
export type AuthorNativeButtonScriptV1=Pick<AuthorNativeScriptV1,'scriptId'|'identity'|'realmId'|'enabled'|'button'|'name'>

/** The same catalog is serialized into the author realm and used by the
 * native action area. Event names locate buttons; they never grant authority. */
export function createAuthorNativeScriptButtonCatalog(scripts:readonly AuthorNativeButtonScriptV1[]){
  const enabled=scripts.filter(script=>script.enabled).map(script=>({...script,button:script.button
    ?{enabled:script.button.enabled,buttons:script.button.buttons.map(button=>({...button}))}:undefined}))
  const event=(scriptId:string,name:string)=>'native-script-button:'+JSON.stringify([scriptId,name])
  const id=(script:AuthorNativeButtonScriptV1)=>script.scriptId??script.identity
  const get=(scriptId:string)=>{
    const script=enabled.find(script=>id(script)===scriptId)
    if(!script)throw Error('AUTHOR_NATIVE_SCRIPT_ADDRESS_UNAVAILABLE')
    return script
  }
  const visible=()=>enabled.flatMap(script=>script.button?.enabled?script.button.buttons.filter(button=>button.visible)
    .map(button=>({scriptId:id(script),realmId:script.realmId,name:button.name,event:event(id(script),button.name)})):[])
  return {
    getButtonEvent:(scriptId:string,name:string)=>{get(scriptId);return event(scriptId,name)},
    getScriptButtons:(scriptId:string)=>get(scriptId).button?.buttons.map(button=>({...button}))??[],
    /** Applies accepted effective metadata. Persistence belongs to Source. */
    replaceScriptButtons:(scriptId:string,buttons:readonly {name:string;visible:boolean}[])=>{
      const script=get(scriptId)
      script.button={enabled:script.button?.enabled??true,buttons:buttons.map(button=>({...button}))}
    },
    acceptSnapshot:(snapshot:AuthorNativeScriptButtonsSnapshotV1)=>{
      for(const state of snapshot.scripts){
        const script=enabled.find(script=>id(script)===state.scriptId)
        if(script)script.button={enabled:state.enabled,buttons:state.buttons.map(button=>({...button}))}
      }
    },
    getAllEnabledScriptButtons:()=>{
      const result:Record<string,{button_id:string;button_name:string}[]>={}
      for(const row of visible())(result[row.scriptId]??=[]).push({button_id:row.event,button_name:row.name})
      return result
    },visible,
  }
}

/** A mount owns its actual DOM handlers. Source revocation cannot dispatch a
 * retained/detached button, even before its old DOM has been removed. */
export function mountAuthorNativeScriptButtons(container:HTMLElement,scripts:readonly AuthorNativeButtonScriptV1[],
  options:{current():boolean;dispatch(realmId:string,event:string):void;metadata?:AuthorNativeScriptButtonsSnapshotV1}){
  let active=true
  let section:HTMLElement|undefined
  const cleanup:(()=>void)[]=[]
  function clear(){for(const stop of cleanup)stop();cleanup.length=0;section?.replaceChildren()}
  function update(value:readonly AuthorNativeButtonScriptV1[],metadata?:AuthorNativeScriptButtonsSnapshotV1){
    if(!active||!options.current())return
    clear()
    const catalog=createAuthorNativeScriptButtonCatalog(value)
    if(metadata)catalog.acceptSnapshot(metadata)
    const rows=catalog.visible()
    if(!rows.length){section?.remove();return}
    const document=container.ownerDocument
    if(!section){
      section=document.createElement('section')
      section.setAttribute('aria-label','作者动作');section.className='rp-author-script-actions'
      section.style.cssText='display:flex;flex-wrap:wrap;gap:8px;padding:8px 0'
    }
    for(const row of rows){
      const button=document.createElement('button');button.type='button';button.textContent=row.name
      button.dataset.scriptId=row.scriptId;button.className='dsh-rp-btn rp-author-script-action'
      const click=()=>{if(active&&options.current())options.dispatch(row.realmId,row.event)}
      button.addEventListener('click',click);cleanup.push(()=>button.removeEventListener('click',click));section.append(button)
    }
    container.append(section)
  }
  update(scripts,options.metadata)
  return {update,dispose(){active=false;clear();section?.remove()}}
}
