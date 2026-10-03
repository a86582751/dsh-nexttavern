import assert from 'node:assert/strict'
import {createManagementPanels} from '../lib/ui/management-panels.js'
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
function panels(r,jsonFetch,drafts=new Map(),options={}){return createManagementPanels({React:r.React,jsonFetch,sessionDrafts:drafts,toast(){},confirmWithDialog:async()=>true,btn:(label,onClick,extra)=>r.React.createElement('button',{onClick,...extra},label),...options})}
const modelReply={catalog:[],main:{provider:'p',model:'main'},global:{revision:1},session:{revision:1},effective:{}}
const importResource={id:'a'.repeat(64),name:'Synthetic private card name',path:'private/card.json',
  type:'application/json',bytes:20,text:'SYNTHETIC_PRIVATE_CARD_TEXT'}
const memoryStorage=()=>{const records=new Map();return {records,
  getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value),removeItem:key=>records.delete(key)}}
const importKey=(sessionId,resourceId)=>`dsh.nexttavern.card-import.v1.${encodeURIComponent(JSON.stringify([sessionId,resourceId]))}`
const listResponse=resources=>({ok:true,text:async()=>JSON.stringify({resources})})
async function resourcePanel(jsonFetch,storage,sessionId='story',messages=[]){
  const r=hooks(),p=panels(r,jsonFetch,new Map(),{importRequestStorage:storage,toast:message=>messages.push(message)})
  r.mount(p.ResourcesPanel,{sessionId});await r.flush();return r
}
const clickImport=async r=>{await button(r,'载入当前').props.onClick();await r.flush()}
const importFetch=onPost=>async(url,init)=>url==='/api/roleplay/jobs'
  ?onPost(JSON.parse(init.body)):url.includes('/openings')?{candidates:[]}:{cardImport:null}
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
const originalFetch=globalThis.fetch,originalSetInterval=globalThis.setInterval,
  originalClearInterval=globalThis.clearInterval,originalDocument=globalThis.document
try{
  {
    globalThis.document={}
    globalThis.fetch=async()=>listResponse([importResource])
    const storage=memoryStorage(),requests=[],messages=[],completedJobs=new Map()
    const jsonFetch=importFetch(request=>{
      requests.push(request)
      const record=JSON.parse(storage.getItem(importKey(request.sessionId,request.resourceId)))
      assert.equal(record.requestId,request.requestId,'identity must be durable before the POST')
      assert.deepEqual(Object.keys(record).sort(),['createdAt','requestId','resourceId','schemaVersion','sessionId'])
      assert.equal(record.schemaVersion,1);assert(Number.isFinite(record.createdAt)&&record.createdAt>=0)
      const saved=JSON.stringify(record)
      for(const privateValue of [importResource.name,importResource.path,importResource.text])assert(!saved.includes(privateValue))
      if(!completedJobs.has(request.requestId))completedJobs.set(request.requestId,{status:'completed',requestId:request.requestId})
      if(requests.length<=2)throw Error('lost completed response')
      return {job:completedJobs.get(request.requestId)}
    })
    const r=await resourcePanel(jsonFetch,storage,'story',messages)
    await clickImport(r);await clickImport(r)
    assert.equal(requests[0].requestId,requests[1].requestId,'same mount retries retain identity')
    r.unmount()
    const fresh=await resourcePanel(jsonFetch,storage,'story',messages)
    await clickImport(fresh)
    assert.equal(requests.length,3)
    assert.equal(completedJobs.size,1,'UI retries consult one simulated completed server receipt')
    assert.equal(requests[0].requestId,requests[2].requestId,
      'lost completed response must reuse one client request identity after remount')
    assert.equal(requests[0].resourceId,importResource.id)
    assert.equal(storage.records.size,0,'matching completed receipt clears the index')
    assert.equal(messages.at(-1),'原导入任务已完成，请核对当前角色卡和开场')
    await clickImport(fresh)
    assert.notEqual(requests[3].requestId,requests[0].requestId,'explicit import after completed receipt creates a new identity')
    assert.equal(messages.at(-1),'角色卡已导入，请选择开场')
    fresh.unmount()
  }
  {
    const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),storage=memoryStorage(),requests=[]
    let unreadable=true
    try{
      Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){if(unreadable)throw Error('blocked');return storage}})
      const jsonFetch=importFetch(request=>{requests.push(request);return {job:{status:'running'}}})
      const r=await resourcePanel(jsonFetch,undefined);await clickImport(r)
      assert.equal(requests.length,0,'default localStorage access failures also block admission')
      unreadable=false;await clickImport(r);r.unmount()
      const fresh=await resourcePanel(jsonFetch,undefined);await clickImport(fresh);fresh.unmount()
      assert.equal(requests[0].requestId,requests[1].requestId,'default browser storage survives a new panel factory')
    }finally{
      if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor)
      else delete globalThis.localStorage
    }
  }
  {
    const storage=memoryStorage(),requests=[],messages=[]
    const receipts=[{status:'failed',error:'controlled failure'},{status:'unknown'},{status:'running'},
      {status:'completed',requestId:'wrong-request'}, {status:'completed'},null]
    const jsonFetch=importFetch(request=>{
      requests.push(request);const job=receipts.shift()
      return job===null?{}:{job}
    })
    for(let i=0;i<6;i++){
      const r=await resourcePanel(jsonFetch,storage,'story',messages);await clickImport(r);r.unmount()
      assert.equal(storage.records.size,1,'failed, unknown and untrusted completed replies retain recovery identity')
    }
    assert(requests.every(request=>request.requestId===requests[0].requestId))
    assert(messages.some(message=>message.includes('回执与原请求标识不一致')))
    assert(messages.some(message=>message.includes('状态无法确认')))
  }
  {
    const key=importKey('story',importResource.id),messages=[];let posts=0
    const noPost=importFetch(()=>{posts++;return {}})
    for(const failure of ['read','write','bad-json','unknown-schema','invalid-time','invalid-request','oversized-record']){
      const storage=memoryStorage()
      if(failure==='read')storage.getItem=()=>{throw Error('storage unavailable')}
      if(failure==='write')storage.setItem=()=>{throw Error('storage full')}
      if(failure==='bad-json')storage.records.set(key,'{broken')
      if(failure==='oversized-record')storage.records.set(key,' '.repeat(2049))
      if(failure==='unknown-schema'||failure==='invalid-time')storage.records.set(key,JSON.stringify({
        schemaVersion:failure==='unknown-schema'?2:1,sessionId:'story',resourceId:importResource.id,
        requestId:'existing-request',createdAt:failure==='invalid-time'?-1:1}))
      if(failure==='invalid-request')storage.records.set(key,JSON.stringify({schemaVersion:1,sessionId:'story',
        resourceId:importResource.id,requestId:'invalid request!',createdAt:1}))
      const before=storage.records.get(key)
      const r=await resourcePanel(noPost,storage,'story',messages);await clickImport(r);r.unmount()
      assert.equal(posts,0,`${failure} must prevent POST instead of replacing the recovery identity`)
      assert.equal(storage.records.get(key),before,'invalid or unreadable index is preserved')
    }
    assert(messages.some(message=>message.includes('浏览器站点存储')))
    assert(messages.some(message=>message.includes('版本不支持')))
    const storage=memoryStorage(),attempted=[]
    storage.setItem=(key,value)=>{attempted.push(JSON.parse(value).requestId);if(attempted.length===1)throw Error('full');storage.records.set(key,value)}
    const r=await resourcePanel(noPost,storage);await clickImport(r);assert.equal(posts,0)
    await clickImport(r);assert.equal(posts,1);assert.equal(attempted[0],attempted[1],'a failed write retains its preflight identity for retry');r.unmount()
  }
  {
    const storage=memoryStorage(),requests=[]
    const jsonFetch=importFetch(request=>{requests.push(request);return {job:{status:'running'}}})
    for(const [sessionId,resourceId] of [['story:one',importResource.id],['story:two',importResource.id],['story:one','b'.repeat(64)]]){
      globalThis.fetch=async()=>listResponse([{...importResource,id:resourceId}])
      const r=await resourcePanel(jsonFetch,storage,sessionId);await clickImport(r);r.unmount()
      assert(storage.records.has(importKey(sessionId,resourceId)))
    }
    assert.equal(new Set(requests.map(request=>request.requestId)).size,3,'session and content identity isolate operations')
    assert.equal(storage.records.size,3)
  }
  {
    globalThis.fetch=async()=>listResponse([importResource])
    const storage=memoryStorage(),requests=[],first=deferred(),second=deferred(),messages=[]
    const jsonFetch=importFetch(request=>{requests.push(request);return requests.length===1?first.promise:second.promise})
    const r=await resourcePanel(jsonFetch,storage,'story',messages),click=button(r,'载入当前').props.onClick
    const firstPost=click(),secondPost=click();await r.flush()
    assert.equal(requests.length,2);assert.equal(requests[0].requestId,requests[1].requestId,
      'two in-flight panel submissions must share the persisted request identity')
    first.resolve({job:{status:'completed',requestId:requests[0].requestId}});await firstPost;await r.flush()
    assert.equal(storage.records.size,0)
    assert.equal(messages.at(-1),'角色卡已导入，请选择开场')
    second.resolve({job:{status:'completed',requestId:requests[1].requestId}});await secondPost;await r.flush()
    assert.equal(storage.records.size,0,'a repeated completed receipt remains an idempotent success')
    assert.deepEqual(messages,['角色卡已导入，请选择开场','原导入任务已完成，请核对当前角色卡和开场'],
      'both matching completion receipts succeed without an identity-replacement error')
    r.unmount()
  }
  {
    globalThis.fetch=async()=>listResponse([importResource])
    const storage=memoryStorage(),requests=[],first=deferred(),second=deferred(),messages=[]
    const jsonFetch=importFetch(request=>{
      requests.push(request)
      return requests.length===1?first.promise:requests.length===2?second.promise:{job:{status:'running'}}
    })
    const old=await resourcePanel(jsonFetch,storage,'story',messages),oldPost=button(old,'载入当前').props.onClick()
    await old.flush();old.unmount()
    const fresh=await resourcePanel(jsonFetch,storage,'story',messages),freshPost=button(fresh,'载入当前').props.onClick()
    await fresh.flush();assert.equal(requests[0].requestId,requests[1].requestId)
    second.resolve({job:{status:'completed',requestId:requests[1].requestId}});await freshPost;await fresh.flush()
    await clickImport(fresh)
    assert.notEqual(requests[2].requestId,requests[0].requestId)
    first.resolve({job:{status:'completed',requestId:requests[0].requestId}});await oldPost
    assert.equal(JSON.parse(storage.getItem(importKey('story',importResource.id))).requestId,requests[2].requestId,
      'late completed reply must not clear the newer import identity')
    assert(messages.at(-1).includes('当前恢复标识已变化'));fresh.unmount()
  }
  {
    const storage=memoryStorage(),requests=[],messages=[];let refuseClear=true
    storage.removeItem=key=>{if(refuseClear)throw Error('clear unavailable');storage.records.delete(key)}
    const jsonFetch=importFetch(request=>{requests.push(request);return {job:{status:'completed',requestId:request.requestId}}})
    const r=await resourcePanel(jsonFetch,storage,'story',messages);await clickImport(r);r.unmount()
    assert.equal(storage.records.size,1)
    assert.equal(messages.at(-1),'角色卡导入：原导入任务已完成，但无法清除恢复标识；请检查浏览器站点存储，之后可再次点击确认同一任务',
      'completed import with a cleanup error must not be described as an import failure')
    refuseClear=false
    const fresh=await resourcePanel(jsonFetch,storage);await clickImport(fresh);fresh.unmount()
    assert.equal(requests[0].requestId,requests[1].requestId);assert.equal(storage.records.size,0)
  }
  {
    globalThis.fetch=async()=>({ok:true,text:async()=>JSON.stringify({resources:[]})})
    const r=hooks(),report={total:4,omitted:0,counts:{interpreted:1,'preserved-unexecuted':1,
      'missing-external-resource':1,'requires-optional-analysis':1},entries:[
      {sourcePointer:'/data/name',status:'interpreted',reason:'structured-projection'},
      {sourcePointer:'/data/extensions/example',status:'preserved-unexecuted',reason:'extension-runtime-not-wired'},
      {sourcePointer:'/data/assets/0',status:'missing-external-resource',reason:'external-asset-not-bundled'},
      {sourcePointer:'/data/extensions/analysis',status:'requires-optional-analysis',reason:'optional-analysis-not-run'}]}
    const p=panels(r,async url=>url.includes('/state?')?{cardImport:{capabilityReport:report}}:{candidates:[]})
    r.mount(p.ResourcesPanel,{sessionId:'story'});await r.flush()
    const displayed=text(r.seat)
    for(const status of ['已解释为结构化资料：1','已保留，未执行：1','外部资源未随卡附带：1','需要可选分析：1'])
      assert(displayed.includes(status),`capability status ${status} is visible`)
    assert(displayed.includes('/data/assets/0 · 外部资源未随卡附带 · 卡内没有资源字节；未请求或验证外部 URL'))
    assert(!displayed.includes('URL 已验证'))
    r.unmount()
  }
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
}finally{globalThis.fetch=originalFetch;globalThis.setInterval=originalSetInterval;
  globalThis.clearInterval=originalClearInterval;globalThis.document=originalDocument}
console.log('management-panels-ui=ok (durable import identity/reload/receipt/storage failures, save locks, stale responses and export polling)')
