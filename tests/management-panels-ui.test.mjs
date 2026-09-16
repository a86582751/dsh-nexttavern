import assert from 'node:assert/strict'
import {createManagementPanels} from '../src/management-panels.js'
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}}
function hooks(){
  const cells=[];let index=0,pending=[],dirty=false,component,props,seat
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]))
  const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),Fragment:'fragment',
    useState(initial){const id=index++;cells[id]??={value:typeof initial==='function'?initial():initial};return [cells[id].value,next=>{cells[id].value=typeof next==='function'?next(cells[id].value):next;dirty=true}]},
    useRef(value){const id=index++;return cells[id]??={current:value}},
    useCallback(fn,deps){const id=index++;if(!same(cells[id]?.deps,deps))cells[id]={deps,value:fn};return cells[id].value},
    useEffect(fn,deps){const id=index++,old=cells[id];if(!same(old?.deps,deps))pending.push(()=>{old?.cleanup?.();cells[id]={deps,cleanup:fn()}})}}
  const render=()=>{index=0;dirty=false;seat=component(props);const work=pending;pending=[];work.forEach(fn=>fn())}
  return {React,mount(fn,p){component=fn;props=p;render()},get seat(){return seat},async flush(){for(let i=0;i<50;i++){await Promise.resolve();if(dirty)render()}},unmount(){cells.forEach(c=>c?.cleanup?.())}}
}
const nodes=(node,out=[])=>{if(Array.isArray(node))node.forEach(n=>nodes(n,out));else if(node!=null){out.push(node);if(typeof node==='object')nodes(node.props.children,out)}return out}
const text=node=>nodes(node).filter(n=>typeof n==='string').join('')
const button=(r,label)=>nodes(r.seat).find(n=>n?.type==='button'&&text(n)===label)
function controls(node,disabled=false,out=[]){if(Array.isArray(node))node.forEach(n=>controls(n,disabled,out));else if(node&&typeof node==='object'){const blocked=disabled||!!node.props.disabled;if(['input','select','textarea','button'].includes(node.type))out.push({node,disabled:blocked});controls(node.props.children,disabled||(node.type==='fieldset'&&blocked),out)}return out}
function panels(r,jsonFetch,drafts=new Map()){return createManagementPanels({React:r.React,jsonFetch,sessionDrafts:drafts,toast(){},confirmWithDialog:async()=>true,btn:(label,onClick,extra)=>r.React.createElement('button',{onClick,...extra},label)})}
const modelReply={catalog:[],main:{provider:'p',model:'main'},global:{revision:1},session:{revision:1},effective:{}}
{
  const r=hooks(),post=deferred(),drafts=new Map(),p=panels(r,async(_,init)=>init?post.promise:modelReply,drafts)
  r.mount(p.ModelPanel,{sessionId:'story'});await r.flush()
  nodes(r.seat).find(n=>n?.type==='input').props.onChange({target:{checked:true}});await r.flush()
  const saved=button(r,'保存模型路由').props.onClick();await r.flush()
  assert(controls(r.seat).every(c=>c.disabled),'model saving locks scope, routes and input controls')
  const later={dirty:true,settings:{allMain:false},baseRevision:1};drafts.set('story:models-session',later)
  post.resolve({...modelReply,session:{revision:2,allMain:true}});await saved;await r.flush()
  assert.equal(drafts.get('story:models-session'),later,'a reopened panel draft survives the former save')
  assert(!r.seat.props.disabled);r.unmount()
}
{
  const r=hooks(),post=deferred(),reply={settings:{revision:1},session:{revision:1,enabled:false},global:{revision:1},characters:[{id:'npc',name:'NPC'}]}
  const p=panels(r,async(url,init)=>init?post.promise:url.includes('character-cluster')?reply:modelReply)
  r.mount(p.CharacterClusterPanel,{sessionId:'story'});await r.flush()
  nodes(r.seat).find(n=>n?.type==='input').props.onChange({target:{checked:true}});await r.flush()
  const saved=button(r,'保存当前对话设置').props.onClick();await r.flush()
  assert(controls(r.seat).every(c=>c.disabled),'cluster saving also locks global and per-character routes')
  post.reject(Error('controlled failure'));await saved;await r.flush()
  assert.equal(nodes(r.seat).find(n=>n?.type==='input').props.checked,true,'failure retains edits')
  assert(controls(r.seat).some(c=>!c.disabled));r.unmount()
}
const originalFetch=globalThis.fetch,originalSetInterval=globalThis.setInterval,originalClearInterval=globalThis.clearInterval
try{
  const first=deferred(),second=deferred();let fetchCalls=0
  globalThis.fetch=async()=>fetchCalls++===0?first.promise:second.promise
  const a=deferred(),b=deferred(),r=hooks(),p=panels(r,async url=>url.includes('resourceId=a')?a.promise:b.promise)
  r.mount(p.ResourcesPanel,{sessionId:'old'});await r.flush()
  r.mount(p.ResourcesPanel,{sessionId:'new'});await r.flush()
  const response=resources=>({ok:true,text:async()=>JSON.stringify({resources})})
  second.resolve(response([{id:'a',name:'A',path:'a'},{id:'b',name:'B',path:'b'}]));await r.flush()
  first.resolve(response([{id:'old',name:'OLD',path:'old'}]));await r.flush();assert(!text(r.seat).includes('OLD'))
  const view=nodes(r.seat).filter(n=>n?.type==='button'&&text(n)==='查看')
  const pa=view[0].props.onClick(),pb=view[1].props.onClick()
  b.resolve({text:'NEW_PREVIEW'});await pb;await r.flush();a.resolve({text:'OLD_PREVIEW'});await pa;await r.flush()
  assert(text(r.seat).includes('NEW_PREVIEW'));assert(!text(r.seat).includes('OLD_PREVIEW'));r.unmount()
  let tick;globalThis.setInterval=fn=>(tick=fn,1);globalThis.clearInterval=()=>{}
  const old=deferred(),fresh=deferred();let gets=0;const e=hooks(),ep=panels(e,async(_,init)=>init?{}:gets++===0?old.promise:fresh.promise)
  e.mount(ep.ExportPanel,{sessionId:'story'});await e.flush();tick();assert.equal(gets,1,'slow polls must not overlap or starve every response')
  const started=button(e,'导出完整小说').props.onClick();await e.flush()
  fresh.resolve({jobs:[{id:'j',kind:'novel-export',status:'completed',resourceId:'file'}]});await started;await e.flush()
  old.resolve({jobs:[{id:'j',kind:'novel-export',status:'running'}]});await e.flush()
  assert(text(e.seat).includes('下载文件'),'late jobs response must not erase completed download');e.unmount()
  const retry=deferred(),rr=hooks();let posts=0
  const rp=panels(rr,async(_,init)=>{if(init){posts++;return retry.promise}return {jobs:[{id:'retry-job',kind:'novel-export',status:'failed'}]}})
  rr.mount(rp.ExportPanel,{sessionId:'story'});await rr.flush();const click=button(rr,'重试').props.onClick
  const request=click();click();await rr.flush();assert.equal(posts,1,'double retry must not duplicate a paid job steering request');assert.equal(button(rr,'重试').props.disabled,true)
  retry.resolve({});await request;await rr.flush();assert.equal(button(rr,'重试').props.disabled,false);rr.unmount()
}finally{globalThis.fetch=originalFetch;globalThis.setInterval=originalSetInterval;globalThis.clearInterval=originalClearInterval}
console.log('management-panels-ui=ok (save locks, reopened drafts, stale resource/session responses and export polling)')
