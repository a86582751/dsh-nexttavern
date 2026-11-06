import assert from 'node:assert/strict'
import {createStatusSurface} from '../lib/ui/status-surface.js'
import {createRoleplayStateStore} from '../lib/ui/state-store.js'

// Run the actual overlay hooks and seat against a minimal browser surface.
const windowEvents=new EventTarget(),documentEvents=new EventTarget(),storage=new Map()
globalThis.window=Object.assign(windowEvents,{innerWidth:1200,innerHeight:800})
globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)}
const parent={insertBefore(node){node.parentElement=this},getBoundingClientRect:()=>({})}
const editor={isConnected:true,closest:selector=>selector==='[data-composer-card]'?parent:null,getClientRects:()=>[{}],parentElement:parent}
globalThis.document=Object.assign(documentEvents,{hidden:false,body:{classList:{toggle(){},remove(){}}},querySelectorAll:()=>[editor],createElement:()=>({content:{querySelectorAll:()=>[]},setAttribute(){},remove(){this.parentElement=null}})})
globalThis.MutationObserver=class {observe(){} disconnect(){}}
const savedInterval=globalThis.setInterval,savedClear=globalThis.clearInterval
const timers=new Map();let timerId=0
globalThis.setInterval=(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId}
globalThis.clearInterval=id=>timers.delete(id)
function hooks(){
  const cells=[];let index=0,pending=[],dirty=false,component,props,tree
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]))
  const React={
    createElement:(type,props,...children)=>({type,props:{...props,children}}),Fragment:'fragment',
    useState(initial){const id=index++;if(!cells[id])cells[id]={value:typeof initial==='function'?initial():initial};return [cells[id].value,next=>{const value=typeof next==='function'?next(cells[id].value):next;if(!Object.is(value,cells[id].value)){cells[id].value=value;dirty=true}}]},
    useRef(value){const id=index++;return cells[id]??= {current:value}},
    useMemo(factory,deps){const id=index++;if(!same(cells[id]?.deps,deps))cells[id]={deps,value:factory()};return cells[id].value},
    useEffect(fn,deps){const id=index++,old=cells[id];if(!same(old?.deps,deps)){pending.push(()=>{old?.cleanup?.();cells[id]={deps,cleanup:fn()}})}},
  }
  React.useSyncExternalStore=(subscribe,getSnapshot)=>{
    const [,update]=React.useState(0)
    React.useEffect(()=>subscribe(()=>update(value=>value+1)),[])
    return getSnapshot()
  }
  React.useLayoutEffect=React.useEffect
  const render=()=>{index=0;dirty=false;tree=component(props);const work=pending;pending=[];work.forEach(fn=>fn())}
  return {React,get tree(){return tree},mount(fn,p){component=fn;props=p;render()},async flush(){for(let i=0;i<20;i++){await Promise.resolve();if(dirty)render()}},render,unmount(){cells.forEach(cell=>cell?.cleanup?.())}}
}
async function fixture(initial={}){
  const runner=hooks();let sid='a',reads=0,seat=null,activity={sessionId:'a',stage:'story',running:true,storySeq:1},hold=false,release
  let data={ok:true,sessionId:'a',preset:'roleplay',decision:{seq:1,options:[{label:'Go'}]},...initial}
  const store=createRoleplayStateStore({isRoleplaySession:()=>true,fetchRoleplayText:async()=>{reads++;const reply={response:{ok:true,status:200},raw:JSON.stringify(data)};if(hold){hold=false;return new Promise(resolve=>{release=()=>resolve(reply)})}return reply}})
  const surface=createStatusSurface({React:runner.React,createRoot:()=>({render:node=>{seat=node},unmount(){}}),resolveActiveSessionId:()=>sid,isRoleplaySession:()=>true,
    useTavernActivity:()=>activity,BackgroundNotesBanner:()=>null,...store,applyImmersive(){},readImmersive:()=>false,runMaintenance:async()=>{},toast(){}})
  runner.mount(surface.StatusOverlay,{sessionId:sid});await runner.flush()
  return {...runner,numericalSeat:surface.numericalSeat,get tree(){return runner.tree},get reads(){return reads},get seat(){return seat},
    update(patch){data={...data,...patch};store.invalidateState(sid)},
    switchSession(next,patch){sid=next;data={ok:true,sessionId:sid,preset:'roleplay',...patch};activity={sessionId:sid};runner.mount(surface.StatusOverlay,{sessionId:sid})},
    oldRead(){hold=true;void store.fetchState('a',true);return ()=>release()},advance(){data={...data,decision:{seq:2,options:[{label:'Next'}]}};activity={...activity,stage:'done',running:false,storySeq:2};runner.render()},close(){runner.unmount();surface.decisionSeat.dispose()}}
}
const originalWorker=globalThis.Worker,requests=[]
globalThis.Worker=class {
  postMessage(task){requests.push({worker:this,task,reply:outputs=>this.onmessage?.({data:{ok:true,value:{outputs}}}),
    fail:()=>this.onmessage?.({data:{ok:false}})})}
  terminate(){this.stopped=true}
}
const children=node=>node?.props?.children??[]
const findClass=(node,name)=>Array.isArray(node)?node.flatMap(value=>findClass(value,name)):
  node&&typeof node==='object'?[...(node.props?.className?.split(' ').includes(name)?[node]:[]),...findClass(children(node),name)]:[]
const text=node=>Array.isArray(node)?node.map(text).join(''):node&&typeof node==='object'?text(children(node)):String(node??'')
const panel=value=>({panel:{title:'{{user}}',fields:[{label:'Position',value}]}})
try {
  const f=await fixture()
  assert.equal(f.seat.props.decision.seq,1)
  const release=f.oldRead()
  f.advance();await f.flush();release();await f.flush()
  assert.equal(f.seat.props.decision.seq,2,'completion must refresh after another component releases a stale shared request')
  assert.equal(f.seat.props.decision.seq,2,'completed activity must update the decision immediately, without waiting for the 30-second timer')
  f.seat.props.onDismiss();await f.flush();assert.equal(f.seat,null)
  window.dispatchEvent(new Event('dsh-roleplay-view-activated'));await f.flush()
  assert.equal(f.seat?.props.decision.seq,2,'switching conversation views must restore a dismissed decision immediately')
  window.dispatchEvent(new Event('dsh-roleplay-decision-toggle'));await f.flush();assert.equal(f.seat,null)
  window.dispatchEvent(new Event('dsh-roleplay-decision-toggle'));await f.flush();assert.equal(f.seat?.props.decision.seq,2)
  f.seat.props.onDismiss();await f.flush();f.close()
  storage.set('dsh-roleplay-ui.decisionDismissed.a','999')
  const reopened=await fixture();assert.equal(reopened.seat?.props.decision.seq,1,'reload ignores obsolete persistent dismissal records');reopened.close()
  storage.set('dsh-roleplay-ui.statusCollapsed','0')
  const schema=await fixture({statusGeneration:{kind:'schema-maintenance'},
    numericalState:{kind:'schema-ready'}})
  assert(!JSON.stringify(schema.tree).includes('刷新状态栏'),
    'schema maintenance must not offer an unsupported narrative rebuild')
  assert(!JSON.stringify(schema.tree).includes('schema-ready'),'the status bar does not embed numerical state')
  schema.numericalSeat.open(true);await schema.flush()
  assert(JSON.stringify(schema.tree).includes('dsh-rp-values-panel'),'values open in an independent window')
  assert(JSON.stringify(schema.tree).includes('schema-ready'),'the independent window receives current values')
  schema.numericalSeat.open(false);await schema.flush()
  assert(!JSON.stringify(schema.tree).includes('schema-ready'),'closing values leaves the narrative status mounted')
  schema.close()
  const legacy=await fixture()
  assert(JSON.stringify(legacy.tree).includes('刷新状态栏'),'legacy narrative rebuild remains available')
  legacy.close()
  const projected=await fixture({userinfo:{name:'Alice'},statusPanel:panel('first'),statusSpec:{regexRules:[{match:'first',replace:'FIRST'}]}})
  const first=requests.at(-1)
  assert.equal(text(findClass(projected.tree,'dsh-rp-status-title')[0]),'Alice','pending projection shows the current user')
  first.reply(['Alice finished','FIRST']);await projected.flush()
  assert.match(text(projected.tree),/FIRST/)
  projected.update({decision:{seq:9,options:[{label:'Different decision'}]}});await projected.flush()
  assert.equal(requests.at(-1),first,'unrelated state refresh reuses the completed status projection')
  assert.match(text(projected.tree),/FIRST/)
  projected.update({statusPanel:panel('second')});await projected.flush()
  const second=requests.at(-1)
  assert.match(text(projected.tree),/second/,'a changed panel renders its current text while replacement is pending')
  assert.doesNotMatch(text(projected.tree),/FIRST|Alice finished/)
  projected.update({userinfo:{name:'Bob'}});await projected.flush()
  const bob=requests.at(-1)
  second.reply(['late Alice','late second']);await projected.flush()
  assert.equal(text(findClass(projected.tree,'dsh-rp-status-title')[0]),'Bob','late old-user output is discarded')
  assert.doesNotMatch(text(projected.tree),/late/)
  bob.reply(['Bob finished','SECOND']);await projected.flush()
  assert.match(text(projected.tree),/SECOND/)
  projected.update({statusSpec:{regexRules:[{match:'second',replace:'CHANGED'}]}});await projected.flush()
  const changedRule=requests.at(-1)
  assert.doesNotMatch(text(projected.tree),/SECOND|Bob finished/,'new rules do not reuse the old completed projection')
  projected.switchSession('b',{userinfo:{name:'Carol'},statusPanel:panel('new session'),statusSpec:{regexRules:[{match:'session',replace:'SESSION'}]}})
  assert.match(text(projected.tree),/状态栏更新中/,'session switch drops the old panel during loading')
  changedRule.reply(['late Bob','late branch']);await projected.flush()
  const carol=requests.at(-1)
  assert.equal(text(findClass(projected.tree,'dsh-rp-status-title')[0]),'Carol')
  assert.doesNotMatch(text(projected.tree),/late Bob|late branch/)
  carol.fail();await projected.flush()
  assert.match(text(projected.tree),/new session/,'Worker failure keeps the current state visible')
  assert.match(text(projected.tree),/状态栏美化暂不可用/)
  projected.update({statusSpec:{regexRules:[]},userinfo:{name:'Dana'}});await projected.flush()
  assert.equal(text(findClass(projected.tree,'dsh-rp-status-title')[0]),'Dana','rule-free user variables render directly')
  assert.equal(requests.at(-1),carol,'rule-free rendering does not enqueue a Worker task')
  assert.doesNotMatch(text(projected.tree),/美化暂不可用/)
  projected.update({statusSpec:{regexRules:[{match:'new',replace:'NEW'}]}});await projected.flush()
  const closing=requests.at(-1)
  projected.close();const closedTree=projected.tree
  closing.reply(['late closed','late closed']);await projected.flush()
  assert.equal(projected.tree,closedTree,'unmounted owners do not accept late Worker replies')
  assert.equal(closing.worker.stopped,true,'unmount releases an active status Worker')
  const author=await fixture({statusPanel:{html:'<p>old</p>',title:'old title',options:[{label:'old'}],fields:[{label:'field',value:'old value'}]},statusSpec:{regexRules:[{match:'old',replace:'beautified'}]}})
  const oldJob=requests.at(-1)
  assert.deepEqual(oldJob.task.texts,['old title','old value','old','<p>old</p>'],
    'status packet keeps title, field, option and HTML as independent strings')
  author.update({statusPanel:{html:'<p>new</p>',options:[{label:'new'}]}});await author.flush()
  assert.equal(oldJob.worker.stopped,true,'a new HTML panel cancels the previous author task')
  requests.at(-1).reply(['new title beauty','new option beauty','<p>new HTML beauty</p>']);await author.flush()
  oldJob.reply(['stale title','stale field','stale option','<p>stale HTML beauty</p>']);await author.flush()
  assert.equal(text(findClass(author.tree,'dsh-rp-status-title')[0]),'new title beauty')
  assert(JSON.stringify(author.tree).includes('<p>new HTML beauty</p>'),'HTML uses its packet index after the option')
  assert(!JSON.stringify(author.tree).includes('stale HTML beauty'),'a late result cannot overwrite the current HTML panel')
  author.update({statusPanel:{html:'<p>fallback</p>'}});await author.flush()
  requests.at(-1).fail();await author.flush()
  assert(JSON.stringify(author.tree).includes('<p>fallback</p>'),'worker failure leaves the current HTML panel readable')
  author.update({statusPanel:{html:'<p>closing</p>'}});await author.flush()
  const closingAuthor=requests.at(-1);author.close()
  assert.equal(closingAuthor.worker.stopped,true,'unmount cancels pending HTML author work')
  console.log('status-surface-refresh=ok (completion refresh, view restore, toggle, reload)')
} finally {globalThis.setInterval=savedInterval;globalThis.clearInterval=savedClear;globalThis.Worker=originalWorker}
