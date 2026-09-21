import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createCardAdaptationPanel} from '../lib/ui/card-adaptation-panel.js'
let modelFocusCount=0,modelScrollCount=0
function renderer(){
 let cells=[],index=0,dirty=false,effects=[],root,props,seat
 const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]))
 const React={createElement:(type,props,...children)=>{const node={type,props:{...props,children}};if(type==='select'&&typeof props?.ref==='function')props.ref({focus(){modelFocusCount++},scrollIntoView(){modelScrollCount++}});return node},
  useState(initial){const i=index++;cells[i]??={value:initial};return [cells[i].value,next=>{const value=typeof next==='function'?next(cells[i].value):next;if(!Object.is(value,cells[i].value)){cells[i].value=value;dirty=true}}]},
  useRef(value){const i=index++;return cells[i]??={current:value}},
  useCallback(fn,deps){const i=index++;if(!equal(cells[i]?.deps,deps))cells[i]={deps,fn};return cells[i].fn},
  useEffect(fn,deps){const i=index++;if(!equal(cells[i]?.deps,deps))effects.push(()=>{cells[i]?.cleanup?.();cells[i]={deps,cleanup:fn()}})}
 }
 function render(){index=0;dirty=false;seat=root(props);const queue=effects;effects=[];queue.forEach(f=>f())}
 return {React,mount(fn,p){root=fn;props=p;render()},get seat(){return seat},async flush(){for(let i=0;i<70;i++){await Promise.resolve();if(dirty)render()}},dispose(){cells.forEach(c=>c?.cleanup?.())}}
}
const nodes=(n,out=[])=>{if(Array.isArray(n))n.forEach(x=>nodes(x,out));else if(n!=null){out.push(n);if(typeof n==='object')nodes(n.props.children,out)}return out}
const text=n=>nodes(n).filter(n=>typeof n==='string').join('')
const timers=new Map();let timerId=0
globalThis.window={setInterval:f=>{const id=++timerId;timers.set(id,f);return id},clearInterval:id=>timers.delete(id)}
globalThis.document={}
const source={sourceId:'a'.repeat(64),name:'测试小说',bytes:10714520,characters:5403971,segments:263,read:263,reviewed:263,status:'finished',revision:1,requiresReregister:true,coverageMeaning:'旧分段覆盖不完整'}
const note={segment:0,facts:'原著事实',implications:'改编机会',questions:'待核实',evidence:'原文证据短句',seq:12}
let revision=1,libraryRevision=7,pendingConfirm=null,delayGet=null,modelRevision=5,modelId='one',autoIndexSettingsRevision=11,autoIndexNewSources=false,autoRebuildLocalOnActive=false,indexPolicy='running',indexFailed=1
const calls=[],runner=renderer()
const snapshot=(sessionId)=>({ok:true,conversationId:sessionId==='other'?'other':'shared',sources:sessionId==='other'?[]:[{...source,indexPolicy,revision}],selectedId:sessionId==='other'?null:source.sourceId,revision,library:{revision:libraryRevision,assets:[{assetId:'asset-one',sourceId:source.sourceId,name:'共享测试小说',bytes:source.bytes,characters:source.characters,references:2,attached:sessionId!=='other'}]},shared:sessionId==='other'?undefined:{assetId:'asset-one',references:2,revision},notes:sessionId==='other'?[]:[note],nextCursor:null,index:{vectors:474,pending:0,running:0,failed:indexFailed,unknown:0,enabled:false,model:'embedding-fixture'},research:sessionId==='other'?undefined:{schemaVersion:1,revision:3,mode:'close-reading',status:'active',target:{protagonist:'林冲',openingPoint:'第 1 章'},budget:{queryBatches:2,maxQueryBatches:24,readPackets:4,maxReadPackets:40},coverage:{ready:true,missing:['结局'],bins:[{id:1,startSegment:0,endSegment:10,covered:true},{id:2,startSegment:11,endSegment:20,covered:false}],categories:[{id:'人物',covered:true}],caveat:'覆盖结果是研究证据，不代表完整理解。'},entries:[{id:'e1',category:'人物',statement:'原著知识摘要',certainty:'高'}],totalEntries:1},researchNotes:sessionId==='other'?undefined:{entries:[{id:'e1',category:'人物',statement:'完整粗颗粒度事实',certainty:'verified-original',citations:[{segment:2,start:4,quote:'原著证据'}],storyOccursAt:'开篇',readerRevealedAt:'第三章',characterKnowledge:'未知'}],total:1,nextCursor:null},semanticModels:[{id:'one',name:'模型一',model:'embedding-one',ready:true},{id:'two',name:'模型二',model:'embedding-two',ready:true}],defaultSemanticModelId:modelId,modelRevision,autoIndexNewSources,autoRebuildLocalOnActive,autoIndexSettingsRevision})
const Panel=createCardAdaptationPanel({React:runner.React,toast(){},confirmWithDialog:()=>new Promise(resolve=>{pendingConfirm=resolve}),jsonFetch:async(url,init)=>{
 const body=init?JSON.parse(init.body):null;calls.push({url,body})
 const sid=body?.sessionId??new URL(url,'http://local').searchParams.get('sessionId')
 if(!body&&delayGet){const waiting=delayGet;delayGet=null;return waiting}
 if(body?.action==='select-model'){assert.equal(body.expectedModelRevision,modelRevision);modelRevision++;modelId=body.providerId}
 else if(body?.action==='attach-source'){assert.equal(body.assetId,'asset-one');assert.equal(body.expectedLibraryRevision,libraryRevision);libraryRevision++}
  else if(body?.action==='detach-source'){assert.equal(body.sourceId,source.sourceId);assert.equal(body.expectedLibraryRevision,libraryRevision);assert.equal(body.expectedRevision,revision);revision++;libraryRevision++}
  else if(body?.action==='publish-source'){assert.equal(body.sourceId,source.sourceId);assert.equal(body.expectedLibraryRevision,libraryRevision);assert.equal(body.expectedRevision,revision);revision++;libraryRevision++}
  else if(body?.action==='auto-index-new-sources'){assert.equal(body.enabled,true);assert.equal(body.expectedAutoIndexSettingsRevision,autoIndexSettingsRevision);assert.equal(body.sourceId,undefined);assert.equal(body.expectedRevision,undefined);autoIndexNewSources=body.enabled;autoIndexSettingsRevision++}
  else if(body?.action==='auto-rebuild-local-on-active'){assert.equal(body.enabled,true);assert.equal(body.expectedAutoIndexSettingsRevision,autoIndexSettingsRevision);assert.equal(body.sourceId,undefined);assert.equal(body.expectedRevision,undefined);autoRebuildLocalOnActive=body.enabled;autoIndexSettingsRevision++}
  else if(body){assert.equal(body.sourceId,source.sourceId);assert.equal(body.expectedRevision,revision);if(['clear-index','rebuild-index','resume-index'].includes(body.action)) assert.equal(body.expectedLibraryRevision,libraryRevision);revision++}
 const result=snapshot(sid);if(!body&&new URL(url,'http://local').searchParams.get('noteMode')==='coarse'&&result.researchNotes)result.researchNotes.nextCursor=2;return result
}})
const button=label=>nodes(runner.seat).find(n=>n?.type==='button'&&text(n)===label)
const click=async label=>{const b=button(label);assert(b,label);assert(!b.props.disabled,label);b.props.onClick();await runner.flush()}
runner.mount(Panel,{sessionId:'first',focusModelSettings:true,focusModelSettingsNonce:1});await runner.flush();assert.equal(modelFocusCount,1);assert.equal(modelScrollCount,1);for(const f of timers.values())f();await runner.flush();assert.equal(modelFocusCount,1,'polling does not steal model-settings focus')
assert(text(runner.seat).includes('研究完成'));assert(text(runner.seat).includes('embedding-fixture'));assert(text(runner.seat).includes('旧分段可能受输出上限截断'));assert(text(runner.seat).includes('重新登记原文件后完整重读'))
assert(text(runner.seat).includes('原著资料库'));assert(text(runner.seat).includes('自动复用原著研究笔记与阅读断点'));assert(text(runner.seat).includes('当前卡的笔记修改独立保存，改编设想不自动成为剧情'));assert(text(runner.seat).includes('共享范围 2 个对话'));assert(text(runner.seat).includes('解除本对话引用'))
assert(text(runner.seat).includes('阅读与改编模式'));assert(text(runner.seat).includes('精读：完整通读原著'));assert(text(runner.seat).includes('覆盖区间：1/2'));assert(!text(runner.seat).includes('完整粗颗粒度事实'))
await click('粗颗粒度笔记');assert.equal(new URL(calls.at(-1).url,'http://local').searchParams.get('noteMode'),'coarse');assert(text(runner.seat).includes('完整粗颗粒度事实'));assert(text(runner.seat).includes('原著证据'));assert(!button('编辑'));assert(!button('删除'));const coarseQuery=nodes(runner.seat).find(n=>n?.type==='input'&&String(n.props.placeholder).includes('搜索原著'));assert(coarseQuery);coarseQuery.props.onChange({target:{value:'人物'}});await runner.flush();await click('搜索');assert.equal(new URL(calls.at(-1).url,'http://local').searchParams.get('noteMode'),'coarse');assert.equal(new URL(calls.at(-1).url,'http://local').searchParams.get('query'),'人物');await click('加载更多粗颗粒度笔记');assert.equal(new URL(calls.at(-1).url,'http://local').searchParams.get('cursor'),'2')
await click('精读笔记');assert.equal(new URL(calls.at(-1).url,'http://local').searchParams.get('noteMode'),'close-reading');assert(button('编辑'))
const librarySelect=nodes(runner.seat).find(n=>n?.type==='select');assert(librarySelect);librarySelect.props.onChange({target:{value:'asset-one'}});await runner.flush();assert.equal(calls.filter(c=>c.body).at(-1).body.action,'attach-source');assert.equal(calls.filter(c=>c.body).at(-1).body.expectedLibraryRevision,7)
let resolvePoll: ((value: ReturnType<typeof snapshot>) => void) | undefined
delayGet=new Promise(resolve=>{resolvePoll=resolve})
const beforeSilentPoll=calls.length;for(const f of timers.values())f();await Promise.resolve();await runner.flush()
assert(calls.length>beforeSilentPoll,'background polling remains observable')
assert(!button('编辑').props.disabled,'background polling does not flash-disable note actions')
button('重建向量').props.onClick();await runner.flush();pendingConfirm?.(true);await runner.flush()
assert.equal(calls.filter(c=>c.body).at(-1).body.action,'rebuild-index','index action is not swallowed while a poll is pending')
const pollAfterMutation=snapshot('first');pollAfterMutation.notes=[{...note,facts:'OLD POLL RESULT'}];resolvePoll?.(pollAfterMutation);await runner.flush()
assert(!text(runner.seat).includes('OLD POLL RESULT'),'preempted polling result cannot overwrite the mutation');assert(!text(runner.seat).includes('后台刷新中'),'preempted polling clears its refresh indicator')
let resolveOldSessionPoll: ((value: ReturnType<typeof snapshot>) => void) | undefined
delayGet=new Promise(resolve=>{resolveOldSessionPoll=resolve})
for(const f of timers.values())f()
delayGet=Promise.resolve(snapshot('second'));runner.mount(Panel,{sessionId:'second'});await runner.flush()
let resolveNewSessionPoll: ((value: ReturnType<typeof snapshot>) => void) | undefined
delayGet=new Promise(resolve=>{resolveNewSessionPoll=resolve})
for(const f of timers.values())f();await Promise.resolve();await runner.flush()
resolveOldSessionPoll?.(snapshot('first'));await runner.flush();assert(text(runner.seat).includes('后台刷新中'),'old session poll cannot clear new session refresh state')
resolveNewSessionPoll?.(snapshot('second'));await runner.flush()
await click('编辑');const prior=calls.length;for(const f of timers.values())f();await runner.flush();assert.equal(calls.length,prior,'polling cannot overwrite a note draft')
assert(button('重建向量').props.disabled)
await click('取消编辑')
await click('重建向量');assert(button('重建向量').props.disabled);assert(nodes(runner.seat).find(n=>n?.type==='select').props.disabled)
const pendingPosts=calls.filter(c=>c.body).length;for(const f of timers.values())f();await runner.flush();assert.equal(calls.filter(c=>c.body).length,pendingPosts)
runner.mount(Panel,{sessionId:'other'});await runner.flush();pendingConfirm(true);await runner.flush()
assert.equal(calls.filter(c=>c.body).length,pendingPosts,'old-session confirmation must not mutate a new conversation')
assert(text(runner.seat).includes('尚无小说原文'))
const autoIndexInputs=nodes(runner.seat).filter(n=>n?.type==='input'&&n.props.type==='checkbox');assert.equal(autoIndexInputs.length,2);const autoIndexInput=autoIndexInputs[0];assert.equal(autoIndexInput.props.checked,false,'auto index defaults off without novels');assert.equal(autoIndexInputs[1].props.checked,false,'auto rebuild defaults off without novels');autoIndexInput.props.onChange({target:{checked:true}});await runner.flush();const autoIndexCall=calls.filter(c=>c.body).at(-1).body;assert.equal(autoIndexCall.action,'auto-index-new-sources');assert.equal(autoIndexCall.sessionId,'other');assert.equal(autoIndexCall.enabled,true);assert.equal(autoIndexCall.expectedAutoIndexSettingsRevision,11);assert.equal(autoIndexCall.sourceId,undefined,'auto index does not target stale selected source');assert.equal(autoIndexCall.expectedRevision,undefined,'auto index uses its own CAS');const autoRebuildInput=nodes(runner.seat).filter(n=>n?.type==='input'&&n.props.type==='checkbox')[1];assert.equal(autoRebuildInput.props.checked,false,'first setting does not toggle second');autoRebuildInput.props.onChange({target:{checked:true}});await runner.flush();const autoRebuildCall=calls.filter(c=>c.body).at(-1).body;assert.equal(autoRebuildCall.action,'auto-rebuild-local-on-active');assert.equal(autoRebuildCall.sessionId,'other');assert.equal(autoRebuildCall.enabled,true);assert.equal(autoRebuildCall.expectedAutoIndexSettingsRevision,12);assert.equal(autoRebuildCall.sourceId,undefined,'auto rebuild does not target stale selected source');assert.equal(autoRebuildCall.expectedRevision,undefined,'auto rebuild uses its own CAS');assert.equal(nodes(runner.seat).filter(n=>n?.type==='input'&&n.props.type==='checkbox')[1].props.checked,true)
const modelLabel=nodes(runner.seat).find(n=>n?.type==='label'&&n.props.children[0]==='模型')
const modelSelect=nodes(modelLabel).find(n=>n?.type==='select');assert(modelSelect)
modelSelect.props.onChange({target:{value:'two'}});await runner.flush()
const beforeModelPoll=calls.length;for(const f of timers.values())f();await runner.flush();assert.equal(calls.length,beforeModelPoll,'pending novel research model choice survives polling')
await click('应用小说研究模型');assert.equal(calls.filter(c=>c.body).at(-1).body.action,'select-model');assert.equal(modelId,'two')
modelSelect.props.onChange({target:{value:''}});await runner.flush();assert.equal(text(runner.seat).includes('不继承剧情记忆模型'),true)
await click('应用小说研究模型');const clearModelCall=calls.filter(c=>c.body).at(-1).body;assert.equal(clearModelCall.action,'select-model');assert.equal(clearModelCall.providerId,'');assert.equal(modelId,'')
runner.mount(Panel,{sessionId:'regenerated'});await runner.flush();indexPolicy='completed';indexFailed=0;for(const f of timers.values())f();await runner.flush();assert(text(runner.seat).includes('后台索引：已完成'),'completed source policy shows completed status')
indexPolicy='running';indexFailed=1;for(const f of timers.values())f();await runner.flush();assert(text(runner.seat).includes('后台索引：需重试'),'failed source takes retry status precedence')
runner.mount(Panel,{sessionId:'regenerated'});await runner.flush();assert(text(runner.seat).includes('原著事实'))
await click('补齐缺少或重试失败');pendingConfirm(true);await runner.flush()
assert.equal(calls.filter(c=>c.body).at(-1).body.action,'resume-index');assert.equal(calls.filter(c=>c.body).at(-1).body.sessionId,'regenerated')
await click('清空向量');pendingConfirm(false);await runner.flush();assert.equal(calls.filter(c=>c.body).at(-1).body.action,'resume-index','cancel does not clear vectors')
const frozenModelRevision=modelRevision
await click('重建向量');modelRevision++;pendingConfirm(true);await runner.flush()
assert.equal(calls.filter(c=>c.body).at(-1).body.expectedModelRevision,frozenModelRevision,'rebuild retains the model revision seen before confirmation')
const client=fs.readFileSync(new URL('../src/ui/client.ts',import.meta.url),'utf8')
assert.match(client.replace(/\s+/g,''),/\['character-cluster','角色集群'\],\['card-adaptation','长文本转角色卡'\]/)
assert.match(client,/case 'card-adaptation':\s*return React\.createElement\(\s*CardAdaptationPanel/)
runner.dispose();console.log('card-adaptation-ui=ok (tab order, draft/poll lock, frozen confirmations, cross-session guard, explicit retry)')
