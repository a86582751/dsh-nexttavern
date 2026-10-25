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
    useEffect(fn,deps){const id=index++,old=cells[id];if(!same(old?.deps,deps)){pending.push(()=>{old?.cleanup?.();cells[id]={deps,cleanup:fn()}})}},
  }
  React.useLayoutEffect=React.useEffect
  const render=()=>{index=0;dirty=false;tree=component(props);const work=pending;pending=[];work.forEach(fn=>fn())}
  return {React,get tree(){return tree},mount(fn,p){component=fn;props=p;render()},async flush(){for(let i=0;i<20;i++){await Promise.resolve();if(dirty)render()}},render,unmount(){cells.forEach(cell=>cell?.cleanup?.())}}
}
async function fixture(initial={},runStatusRegex){
  const runner=hooks();let sid='a',reads=0,seat=null,activity={sessionId:'a',stage:'story',running:true,storySeq:1},hold=false,release
  let data={ok:true,sessionId:'a',preset:'roleplay',decision:{seq:1,options:[{label:'Go'}]},...initial}
  const store=createRoleplayStateStore({isRoleplaySession:()=>true,fetchRoleplayText:async()=>{reads++;const reply={response:{ok:true,status:200},raw:JSON.stringify(data)};if(hold){hold=false;return new Promise(resolve=>{release=()=>resolve(reply)})}return reply}})
  const surface=createStatusSurface({React:runner.React,createRoot:()=>({render:node=>{seat=node},unmount(){}}),resolveActiveSessionId:()=>sid,isRoleplaySession:()=>true,
    useTavernActivity:()=>activity,BackgroundNotesBanner:()=>null,...store,applyImmersive(){},readImmersive:()=>false,runMaintenance:async()=>{},toast(){},runStatusRegex})
  runner.mount(surface.StatusOverlay,{sessionId:sid});await runner.flush()
  return {...runner,get tree(){return runner.tree},get reads(){return reads},get seat(){return seat},update(patch){data={...data,...patch};store.invalidateState('a')},oldRead(){hold=true;void store.fetchState('a',true);return ()=>release()},advance(){data={...data,decision:{seq:2,options:[{label:'Next'}]}};activity={...activity,stage:'done',running:false,storySeq:2};runner.render()},close(){runner.unmount();surface.decisionSeat.dispose()}}
}
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
  assert(!JSON.stringify(schema.tree).includes('叙事状态栏'))
  assert(JSON.stringify(schema.tree).includes('schema-ready'),'the variable panel remains mounted')
  schema.close()
  const legacy=await fixture()
  assert(JSON.stringify(legacy.tree).includes('刷新状态栏'),'legacy narrative rebuild remains available')
  legacy.close()
  const jobs=[]
  const author=await fixture({statusPanel:{html:'<p>old</p>',title:'old title',options:[{label:'old'}],fields:[{label:'field',value:'old value'}]},statusSpec:{regexRules:[{match:'old',replace:'beautified'}]}},
    (task,signal)=>new Promise((resolve,reject)=>jobs.push({task,signal,resolve,reject})))
  const oldJob=jobs.at(-1)
  assert.deepEqual(oldJob.task.texts,['<p>old</p>','old title','old','old value'])
  author.update({statusPanel:{html:'<p>new</p>',options:[{label:'new'}]}});await author.flush()
  assert.equal(oldJob.signal.aborted,true,'a new panel cancels the previous author task')
  jobs.at(-1).resolve(['<p>new beauty</p>','状态栏','new beauty']);await author.flush()
  oldJob.resolve(['<p>stale beauty</p>','状态栏','stale beauty']);await author.flush()
  assert(JSON.stringify(author.tree).includes('<p>new beauty</p>'))
  assert(!JSON.stringify(author.tree).includes('stale beauty'),'a late result cannot overwrite the current panel')
  author.update({statusPanel:{html:'<p>fallback</p>'}});await author.flush()
  jobs.at(-1).reject(new Error('timeout'));await author.flush()
  assert(JSON.stringify(author.tree).includes('<p>fallback</p>'),'worker failure leaves the current panel readable')
  author.update({statusPanel:{html:'<p>closing</p>'}});await author.flush();author.close()
  assert.equal(jobs.at(-1).signal.aborted,true,'unmount cancels pending author work')
  console.log('status-surface-refresh=ok (completion refresh, view restore, toggle, reload)')
} finally {globalThis.setInterval=savedInterval;globalThis.clearInterval=savedClear}
