import assert from 'node:assert/strict'
import {createMemoryRetrievalPanel} from '../src/memory-retrieval-panel.js'

const timers=new Map();let timerId=0
const windowListeners=new Map();globalThis.window={setInterval(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id},clearInterval(id){timers.delete(id)},addEventListener(type,fn){windowListeners.set(type,fn)},removeEventListener(type){windowListeners.delete(type)},dispatchEvent(event){windowListeners.get(event.type)?.(event);return true}}

function hooks(){
  const cells=[];let index=0,pending=[],dirty=false,component,props,seat
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]))
  const React={
    createElement:(type,props,...children)=>({type,props:{...(props??{}),children}}),Fragment:'fragment',
    useState(initial){const id=index++;if(!cells[id])cells[id]={value:typeof initial==='function'?initial():initial};return [cells[id].value,next=>{const value=typeof next==='function'?next(cells[id].value):next;if(!Object.is(value,cells[id].value)){cells[id].value=value;dirty=true}}]},
    useRef(value){const id=index++;return cells[id]??= {current:value}},
    useCallback(fn,deps){const id=index++,old=cells[id];if(!old||!same(old.deps,deps))cells[id]={deps,value:fn};return cells[id].value},
    useEffect(fn,deps){const id=index++,old=cells[id];if(!same(old?.deps,deps))pending.push(()=>{old?.cleanup?.();cells[id]={deps,cleanup:fn()}})},
  }
  React.useLayoutEffect=React.useEffect
  const resolve=node=>{if(node==null||typeof node!=='object')return node;if(Array.isArray(node))return node.map(resolve);if(typeof node.type==='function')return resolve(node.type(node.props));return {...node,props:{...node.props,children:resolve(node.props?.children)}}}
  const render=()=>{index=0;dirty=false;seat=resolve(component(props));const work=pending;pending=[];work.forEach(fn=>fn())}
  return {React,mount(fn,p){component=fn;props=p;render()},get seat(){return seat},async flush(){for(let i=0;i<30;i++){await Promise.resolve();if(dirty)render()}},render}
}
function walk(node,out=[]){if(node==null)return out;if(Array.isArray(node)){node.forEach(n=>walk(n,out));return out}out.push(node);if(typeof node==='object'){walk(node.props?.children,out)}return out}
const textOf=node=>walk(node).filter(n=>typeof n==='string').join('')
const buttons=(node)=>walk(node).filter(n=>n?.type==='button')
const button=(node,label)=>buttons(node).find(n=>textOf(n.props.children)===label||n.props['aria-label']===label)??buttons(node).find(n=>textOf(n.props.children).includes(label))
const inputs=(node)=>walk(node).filter(n=>n?.type==='input')
const select=(node,value)=>walk(node).find(n=>n?.type==='select'&&n.props.value===value)
const base=(revision=1,extra={})=>({ok:true,revision,mode:'keyword',scope:'session',indexEnabled:false,autoIndexNewConversations:false,autoRebuildLocalOnRetrieval:false,chunkChars:480,effectiveChunkChars:480,activeProviderId:null,providers:[],catalog:[],progress:{vectors:0,sources:0,covered:0,pending:0,running:0,failed:0,unknown:0,bytes:0},modelList:{ids:[],fetchedAt:null,error:null},...extra})

let calls=[];let queuedGets=[];let confirmationPending=[];let confirmationOutcome=true;const confirmationPosts=[];const configNotices=[]
const jsonFetch=async(url,init)=>{
  const body=init?.body?JSON.parse(init.body):null;calls.push({url,body})
  if(url.includes('/retrieval-confirmations')){if(body){confirmationPosts.push(body);if(confirmationOutcome)confirmationPending=[];return confirmationOutcome?{ok:true}:{ok:false,error:'目标已变化'}}return {ok:true,pending:confirmationPending}}
  if(!init){if(url.includes('usage-requests'))return {sessions:[{id:'s1',label:'Current'},{id:'s2',label:'Second'},{id:'s3',label:'Third'}]};if(queuedGets.length)return queuedGets.shift();return nextReply??base()}
  return nextReply??base(2)
}
let nextReply=base(1,{catalog:[{id:'qwen',name:'Qwen',status:'available',languages:'zh/en',downloadedBytes:0,totalBytes:100}]})
const runner=hooks();const {EmbeddingPanel,MemoryPanel}=createMemoryRetrievalPanel({React:runner.React,jsonFetch,toast(){}})
runner.mount(EmbeddingPanel,{sessionId:'s1'});await runner.flush()
assert.equal(runner.seat.props.children[0].props['aria-label'],'Embedding 模型设置')
assert.equal(calls[0].body,null)
assert.equal(button(runner.seat,'重建向量数据库').props.disabled,true)
assert.equal(button(runner.seat,'清空向量数据库').props.disabled,false)
const beforeUnconfiguredClear=calls.length
button(runner.seat,'清空向量数据库').props.onClick();await runner.flush()
assert.equal(calls.length,beforeUnconfiguredClear)
assert(textOf(runner.seat).includes('当前未启用供应商'))
button(runner.seat,'确认').props.onClick();await runner.flush()
assert.equal(calls.at(-1).body.action,'clear-index');assert.equal(calls.at(-1).body.confirmProviderId,null);assert.equal(calls.at(-1).body.expectedRevision,1)

// New provider: the complete key must survive controlled re-renders and be sent with the save action.
button(runner.seat,'新增接入').props.onClick();await runner.flush()
const all=inputs(runner.seat);const name=all.find(i=>i.props.placeholder==='My embedding provider');const key=all.find(i=>i.props.type==='password')
name.props.onChange({target:{value:'Online'},currentTarget:{value:'Online'}});key.props.onChange({target:{value:'sk-full-key'},currentTarget:{value:'sk-full-key'}});all.find(i=>i.props.placeholder==='例如 2026-09-14').props.onChange({target:{value:'r1'},currentTarget:{value:'r1'}});await runner.flush()
assert.equal(button(runner.seat,'用于剧情记忆').props.disabled,true,'dirty form cannot activate stale saved settings')
nextReply=base(2,{providers:[{id:'p1',name:'Online',kind:'online',protocol:'openai',dimensions:null,keySet:true,ready:true}]});button(runner.seat,'保存供应商').props.onClick();await runner.flush()
const save=calls.at(-1);assert.equal(save.body.action,'save-provider');assert.equal(save.body.provider.apiKey,'sk-full-key');assert.equal(save.body.provider.id,undefined);assert.equal(save.body.provider.embeddingRevision,'r1')

// Server id is now bound to the selected provider; test uses that id.
nextReply=base(3,{providers:[{id:'p1',name:'Online',kind:'online',protocol:'openai',dimensions:null,keySet:true,ready:true}]});
button(runner.seat,'测试').props.onClick();await runner.flush();assert.equal(calls.at(-1).body.action,'test-provider');assert.equal(calls.at(-1).body.providerId,'p1')

// A running download is refreshed by the 2s poll and exposes progress.
nextReply=base(4,{catalog:[{id:'qwen',name:'Qwen',status:'available',languages:'zh/en',downloadedBytes:0,totalBytes:100}]});button(runner.seat,'刷新模型列表').props.onClick();await runner.flush();
nextReply=base(5,{progress:{vectors:0,sources:1,covered:0,pending:1,running:1,failed:0,unknown:0,bytes:4},catalog:[{id:'qwen',name:'Qwen',status:'downloading',languages:'zh/en',downloadedBytes:4,totalBytes:100}]});assert(textOf(runner.seat).includes('运行环境会按需安装或更新'));button(runner.seat,'下载／安装').props.onClick();await runner.flush();assert.equal(timers.size>0,true)
nextReply=base(6,{progress:{vectors:0,sources:1,covered:0,pending:1,running:1,failed:0,unknown:0,bytes:50},catalog:[{id:'qwen',name:'Qwen',status:'downloading',languages:'zh/en',downloadedBytes:50,totalBytes:100}]});for(const timer of timers.values())await timer.fn();await runner.flush();assert(walk(runner.seat).some(n=>n?.props?.style?.width==='50%'))

// A stale GET must not overwrite a dirty provider draft, and must not lower a newer revision.
nextReply=base(6,{providers:[{id:'p1',name:'Online',kind:'online',protocol:'openai',dimensions:null,keySet:true,ready:true}]});button(runner.seat,'新增接入').props.onClick();await runner.flush();const dirtyName=inputs(runner.seat).find(i=>i.props.placeholder==='My embedding provider');dirtyName.props.onChange({target:{value:'Dirty'},currentTarget:{value:'Dirty'}});await runner.flush();queuedGets.push(Promise.resolve(base(1)));for(const timer of timers.values())await timer.fn();await runner.flush();assert.equal(inputs(runner.seat).find(i=>i.props.placeholder==='My embedding provider')?.props.value,'Dirty')

// An inactive provider keeps its own refreshed model list across active-provider polling.
const providers=[{id:'p1',name:'First',model:'first-embedding',embeddingRevision:'r1',kind:'online',protocol:'openai',baseUrl:'https://relay.example.test/v1',ready:true},{id:'p2',name:'Second',model:'second-embedding',kind:'online',protocol:'dashscope-text',baseUrl:'https://dashscope.aliyuncs.com/compatible-mode/v1',ready:true},{id:'local',name:'Local',model:'qwen',kind:'local',ready:true}]
nextReply=base(7,{activeProviderId:'p1',providers,modelList:{ids:['first-embedding']},progress:{vectors:12,sources:3,covered:2,pending:1,running:0,failed:0,unknown:0,bytes:512,stale:true,staleVectors:12,fingerprint:'fingerprint-abcdefghijklmnopqrstuvwxyz',embedding:{embedding_model:'first-embedding',embedding_revision:'r1',dimensions:1536,task:'document',pooling:'mean'}}})
for(const timer of timers.values())timer.fn();await runner.flush()
assert(textOf(runner.seat).includes('OpenAI 官方 / 兼容接口'));assert(textOf(runner.seat).includes('relay.example.test'));assert(textOf(runner.seat).includes('阿里云 DashScope 文本'))
assert(textOf(runner.seat).includes('配置不匹配，需重建索引'));assert(textOf(runner.seat).includes('语义索引已停用'));assert(textOf(runner.seat).includes('fingerprint-abcdefgh'));assert(textOf(runner.seat).includes('task=document'));assert(textOf(runner.seat).includes('pooling=mean'))
assert(textOf(runner.seat).includes('模型修订版本（可选）'))
button(runner.seat,'Second').props.onClick();await runner.flush()
nextReply=base(8,{activeProviderId:'p1',providers,modelList:{ids:['second-new-embedding']}})
button(runner.seat,'刷新模型列表').props.onClick();await runner.flush()
nextReply=base(8,{activeProviderId:'p1',providers,modelList:{ids:['first-embedding']}})
for(const timer of timers.values())timer.fn();await runner.flush()
const picker=walk(runner.seat).find(n=>n?.type==='select'&&n.props['aria-label']==='模型 ID 下拉选择')
assert(textOf(picker).includes('second-new-embedding'));assert(!textOf(picker).includes('first-embedding'))
button(runner.seat,'Local').props.onClick();await runner.flush();assert.equal(inputs(runner.seat).filter(n=>n.props.type==='password').length,0)
const localCard=button(runner.seat,'Local');assert(!textOf(localCard).includes('OpenAI 官方 / 兼容接口'));assert(!textOf(localCard).includes('relay.example.test'));assert(!textOf(localCard).includes('Key'));assert(!textOf(runner.seat).includes('OpenAI 官方 Base URL'))
assert.equal(inputs(runner.seat).some(n=>n.props.placeholder==='例如 2026-09-14'),false)

// Switching an online draft to local cannot retain a hidden credential or endpoint.
button(runner.seat,'新增接入').props.onClick();await runner.flush()
inputs(runner.seat).find(n=>n.props.type==='password').props.onChange({target:{value:'synthetic-hidden-key'}});await runner.flush()
select(runner.seat,'online').props.onChange({target:{value:'local'}});await runner.flush()
button(runner.seat,'保存供应商').props.onClick();await runner.flush()
assert.equal(calls.at(-1).body.provider.apiKey,'');assert.equal(calls.at(-1).body.provider.baseUrl,'')

// A late response for the former progress target cannot replace the current one.
let resolveOld
queuedGets.push(new Promise(resolve=>{resolveOld=resolve}))
select(runner.seat,'s1').props.onChange({target:{value:'s2'}});await runner.flush()
nextReply=base(9,{providers,progress:{vectors:303,sources:3,covered:3,pending:0,running:0,failed:0,unknown:0,bytes:99}})
select(runner.seat,'s2').props.onChange({target:{value:'s3'}});await runner.flush()
resolveOld(base(8,{progress:{vectors:202,sources:2,covered:2,pending:0,running:0,failed:0,unknown:0,bytes:99}}));await runner.flush()
assert(textOf(runner.seat).includes('向量：303'));assert(!textOf(runner.seat).includes('向量：202'))

// Destructive index actions require an inline confirmation and target the current provider/revision.
nextReply=base(10,{activeProviderId:'p1',providers,progress:{vectors:3,sources:3,covered:3,pending:0,running:0,failed:0,unknown:0,bytes:99}})
for(const timer of timers.values())timer.fn();await runner.flush()
const beforeConfirm=calls.length
button(runner.seat,'重建向量数据库').props.onClick();await runner.flush()
assert.equal(calls.length,beforeConfirm)
assert(textOf(runner.seat).includes('目标供应商：First'))
assert(textOf(runner.seat).includes('当前可见对话的全部模型向量索引（包含旧版遗留索引'))
assert(textOf(runner.seat).includes('仅为当前启用模型重新索引'))
button(runner.seat,'取消').props.onClick();await runner.flush();assert.equal(calls.length,beforeConfirm)
button(runner.seat,'清空向量数据库').props.onClick();await runner.flush();button(runner.seat,'确认').props.onClick();await runner.flush()
assert.equal(calls.at(-1).body.action,'clear-index');assert.equal(calls.at(-1).body.confirmProviderId,'p1');assert.equal(calls.at(-1).body.expectedRevision,10)

// A provider/revision change clears a stale confirmation before it can submit.
nextReply=base(11,{activeProviderId:'p2',providers,progress:{vectors:4,sources:3,covered:3,pending:0,running:0,failed:0,unknown:0,bytes:100}})
for(const timer of timers.values())timer.fn();await runner.flush()
button(runner.seat,'重建向量数据库').props.onClick();await runner.flush()
nextReply=base(12,{activeProviderId:'p1',providers,progress:{vectors:5,sources:3,covered:3,pending:0,running:0,failed:0,unknown:0,bytes:101}})
for(const timer of timers.values())timer.fn();await runner.flush()
assert(!textOf(runner.seat).includes('确认重建向量数据库？'))
assert(!textOf(runner.seat).includes('新对话自动开启语义索引'),'automatic settings are absent from Embedding panel')
runner.mount(EmbeddingPanel,{sessionId:'s1'});await runner.flush()
const chunkInput=()=>walk(walk(runner.seat).find(n=>n?.type==='label'&&textOf(n).includes('索引块大小（字符）'))).find(n=>n?.type==='input')
assert.equal(chunkInput().props.value,'480');assert(textOf(runner.seat).includes('建议 192（细线索）、480（均衡）、960（较长段落）'));assert(textOf(runner.seat).includes('当前字符目标 480'));assert(textOf(runner.seat).includes('字符数不等于 tokens'))
chunkInput().props.onChange({target:{value:'192'}});await runner.flush();button(runner.seat,'保存索引块大小').props.onClick();await runner.flush()
const chunkPost=calls.filter(c=>c.body).at(-1).body
assert.equal(chunkPost.action,'index-chunk-size');assert.equal(chunkPost.chunkChars,192);assert.equal(chunkPost.expectedRevision,12)
runner.mount(MemoryPanel,{sessionId:'s1',LegacyPanel:props=>props.retrievalControls});await runner.flush()
assert(!button(runner.seat,'清空向量数据库'));assert(textOf(runner.seat).includes('记忆检索方式'));assert(textOf(runner.seat).includes('自动更新语义索引'))
const newAutoInput=()=>walk(walk(runner.seat).find(n=>n?.type==='label'&&textOf(n).includes('新对话自动开启语义索引'))).find(n=>n?.type==='input')
assert.equal(newAutoInput().props.checked,false);assert.equal(newAutoInput().props.disabled,false)
const rebuildInput=()=>walk(walk(runner.seat).find(n=>n?.type==='label'&&textOf(n).includes('对话活跃时，模型配置变化时自动重建'))).find(n=>n?.type==='input')
assert.equal(rebuildInput().props.checked,false);assert.equal(rebuildInput().props.disabled,false)
nextReply=base(13,{activeProviderId:'p1',providers,autoIndexNewConversations:true})
newAutoInput().props.onChange({target:{checked:true}});await runner.flush()
const autoPost=calls.filter(c=>c.body).at(-1).body
assert.equal(autoPost.action,'auto-index-new-conversations');assert.equal(autoPost.enabled,true);assert.equal(autoPost.expectedRevision,12)
nextReply=base(13,{activeProviderId:'p1',providers,autoRebuildLocalOnRetrieval:true})
rebuildInput().props.onChange({target:{checked:true}});await runner.flush()
const rebuildPost=calls.filter(c=>c.body).at(-1).body
assert.equal(rebuildPost.action,'auto-rebuild-local-on-retrieval');assert.equal(rebuildPost.enabled,true);assert.equal(rebuildPost.expectedRevision,13)
nextReply=base(14,{autoIndexNewConversations:true});for(const timer of timers.values())timer.fn();await runner.flush()
assert.equal(newAutoInput().props.disabled,false,'can disable default after provider becomes unavailable')
nextReply=base(15,{autoIndexNewConversations:false});for(const timer of timers.values())timer.fn();await runner.flush()
assert.equal(newAutoInput().props.disabled,true,'cannot enable default without a ready active model')
// A stale semantic index uses the same custom confirmation: enabling indexing must not POST immediately.
nextReply=base(16,{activeProviderId:'p1',providers,progress:{vectors:4,sources:3,covered:3,pending:0,running:0,failed:0,unknown:0,bytes:100,stale:true,staleVectors:4,fingerprint:'stale-fingerprint'}})
for(const timer of timers.values())timer.fn();await runner.flush()
const beforeStaleConfirm=calls.length
const indexInput=()=>walk(walk(runner.seat).find(n=>n?.type==='label'&&textOf(n).includes('自动更新语义索引 / Auto-update semantic index'))).find(n=>n?.type==='input')
indexInput().props.onChange({target:{checked:true}});await runner.flush()
const staleDialog=walk(runner.seat).find(n=>n?.type==='dialog')
assert.equal(calls.length,beforeStaleConfirm);assert.equal(staleDialog.props['aria-modal'],'true');assert.equal(staleDialog.props.role,'alertdialog');assert(textOf(staleDialog).includes('目标模型：First'));assert(textOf(staleDialog).includes('剧情正文、来源和账本保留不变'))
button(runner.seat,'取消').props.onClick();await runner.flush();assert.equal(calls.length,beforeStaleConfirm)
indexInput().props.onChange({target:{checked:true}});await runner.flush()
let escapePrevented=false,escapeStopped=false
walk(runner.seat).find(n=>n?.type==='dialog').props.onKeyDown({key:'Escape',preventDefault(){escapePrevented=true},stopPropagation(){escapeStopped=true}})
await runner.flush();assert(escapePrevented&&escapeStopped,'Escape must not close the parent management dialog');assert(!walk(runner.seat).some(n=>n?.type==='dialog'));assert.equal(calls.length,beforeStaleConfirm)
indexInput().props.onChange({target:{checked:true}});await runner.flush();button(runner.seat,'确认重建并开启').props.onClick();await runner.flush()
const stalePost=calls.filter(c=>c.body).at(-1).body
assert.equal(stalePost.action,'rebuild-index');assert.equal(stalePost.confirmProviderId,'p1');assert.equal(stalePost.expectedRevision,16)
nextReply=base(17,{activeProviderId:'local',providers:[{id:'local',name:'Local',kind:'local',model:'qwen3-0.6b',protocol:'openai',ready:true,dimensions:null,localMaxTokens:512}],catalog:[{id:'qwen3-0.6b',name:'Qwen3',status:'installed',maxInputTokens:32768}]})
runner.mount(EmbeddingPanel,{sessionId:'local-budget'});await runner.flush()
const tokenInput=walk(walk(runner.seat).find(n=>n?.type==='label'&&textOf(n).includes('本地编码预算（tokens）'))).find(n=>n?.type==='input')
assert.equal(tokenInput.props.value,512);assert.equal(tokenInput.props.max,32768);assert(textOf(runner.seat).includes('内存保护仍有效'))
tokenInput.props.onChange({target:{value:'2048'}});await runner.flush();button(runner.seat,'保存供应商').props.onClick();await runner.flush()
assert.equal(calls.filter(c=>c.body).at(-1).body.provider.localMaxTokens,2048)

// Rebuild confirmations live in the permanent overlay and are independent of the management panel.
{ const runner=hooks(); timers.clear()
const toastMessages=[];const {RebuildPrompt}=createMemoryRetrievalPanel({React:runner.React,jsonFetch,toast:message=>toastMessages.push(message)})
confirmationPending=[{id:'novel-1',kind:'novel',model:'Novel model',target:'小说原文索引',reason:'模型配置变化'}]
runner.mount(RebuildPrompt,{sessionId:'s1'});await runner.flush()
let rebuildDialog=walk(runner.seat).find(n=>n?.type==='dialog');assert(rebuildDialog);assert(textOf(rebuildDialog).includes('小说原文索引'));assert(textOf(rebuildDialog).includes('Novel model'));assert(textOf(rebuildDialog).includes('在线模型重建可能产生 API 费用'))
button(runner.seat,'取消').props.onClick();await runner.flush();assert.equal(confirmationPosts.length,1);assert.equal(confirmationPosts[0].action,'cancel');assert.equal(confirmationPosts[0].id,'novel-1')
window.addEventListener('dsh-roleplay-needs-config',event=>configNotices.push(event.detail))
confirmationPending=[{id:'coarse-1',kind:'novel',model:'',target:'',reason:'no-active-provider',action:'configure-adaptation-model'}];for(const timer of timers.values())await timer.fn();await runner.flush();rebuildDialog=walk(runner.seat).find(n=>n?.type==='dialog');assert(textOf(rebuildDialog).includes('粗颗粒度需要小说检索模型'));assert(button(runner.seat,'前往配置'))
confirmationOutcome=false;button(runner.seat,'前往配置').props.onClick();await runner.flush();assert.equal(configNotices.length,0);assert.equal(confirmationPosts.at(-1).action,'cancel');assert(!confirmationPosts.some(post=>post.action==='confirm'));confirmationOutcome=true
confirmationPending=[{id:'coarse-2',kind:'novel',model:'',target:'',reason:'provider-not-ready',action:'configure-adaptation-model'}];for(const timer of timers.values())await timer.fn();await runner.flush();button(runner.seat,'前往配置').props.onClick();await runner.flush();assert.equal(configNotices.at(-1).action,'configure-adaptation-model');assert(!confirmationPosts.some(post=>post.action==='confirm'))
confirmationPending=[{id:'story-1',kind:'story',model:'Story model',target:'剧情记忆索引',reason:'模型配置变化'}];for(const timer of timers.values())await timer.fn();await runner.flush()
rebuildDialog=walk(runner.seat).find(n=>n?.type==='dialog');assert(rebuildDialog);const confirmButton=button(runner.seat,'确认并重建');const beforeStoryConfirm=confirmationPosts.length;confirmButton.props.onClick();confirmButton.props.onClick();await runner.flush();assert.equal(confirmationPosts.length,beforeStoryConfirm+1,'double click sends one POST');assert.equal(confirmationPosts[beforeStoryConfirm].action,'confirm');assert.equal(confirmationPosts[beforeStoryConfirm].id,'story-1');assert(toastMessages.includes('重建任务已在后台启动'))
confirmationPending=[{id:'story-2',kind:'story',model:'Story model',target:'旧目标',reason:'模型配置变化'}];for(const timer of timers.values())await timer.fn();await runner.flush();const oldDialog=walk(runner.seat).find(n=>n?.type==='dialog');assert(oldDialog);const oldConfirm=button(runner.seat,'确认并重建');confirmationPending=[];for(const timer of timers.values())await timer.fn();await runner.flush();assert(!walk(runner.seat).some(n=>n?.type==='dialog'));oldConfirm.props.onClick();await runner.flush();assert.equal(confirmationPosts.length,beforeStoryConfirm+1,'pending disappearance invalidates old confirm click')
confirmationPending=[{id:'story-3',kind:'story',model:'Story model',target:'旧会话',reason:'模型配置变化'}];for(const timer of timers.values())await timer.fn();await runner.flush();const sessionDialog=walk(runner.seat).find(n=>n?.type==='dialog');assert(sessionDialog);const sessionConfirm=button(runner.seat,'确认并重建');confirmationPending=[];runner.mount(RebuildPrompt,{sessionId:'s2'});await runner.flush();assert(!walk(runner.seat).some(n=>n?.type==='dialog'));sessionConfirm.props.onClick();await runner.flush();assert.equal(confirmationPosts.length,beforeStoryConfirm+1,'session switch invalidates old confirm click')
console.log('memory-retrieval-ui=ok (embedding provider save/id, test, polling, stale confirmation, retrieval settings, local token budget, global rebuild prompt)')

}
