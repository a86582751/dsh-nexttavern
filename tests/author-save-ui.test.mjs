import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createAuthorPanels} from '../lib/ui/author-panels.js'
import {createUserInfoSettings} from '../lib/ui/user-info.js'
import {createTelemetryPanels} from '../lib/ui/telemetry-panels.js'

const authorSource=readFileSync(new URL('../src/ui/author-panels.ts',import.meta.url),'utf8')
assert.equal((authorSource.match(/React\.createElement\(\s*'fieldset',\s*\{\s*disabled:\s*saving/g)??[]).length,2,'worldbook and card editors disable their complete form while saving')

function deferred(){let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej});return {promise,resolve,reject}}
function runner(){
  const cells=[];let index=0,dirty=false,pending=[],component,props,seat
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]))
  const React={
    createElement:(type,props,...children)=>({type,props:{...(props??{}),children}}),
    useState(initial){const id=index++,cell=cells[id]??={value:typeof initial==='function'?initial():initial};return [cell.value,next=>{if(cells[id]!==cell)return;const value=typeof next==='function'?next(cell.value):next;if(!Object.is(value,cell.value)){cell.value=value;dirty=true}}]},
    useRef(value){const id=index++;return cells[id]??={current:value}},
    useCallback(fn,deps){const id=index++;if(!same(cells[id]?.deps,deps))cells[id]={deps,fn};return cells[id].fn},
    useMemo(fn,deps){const id=index++;if(!same(cells[id]?.deps,deps))cells[id]={deps,value:fn()};return cells[id].value},
    useEffect(fn,deps){const id=index++,old=cells[id];if(!same(old?.deps,deps))pending.push(()=>{old?.cleanup?.();cells[id]={deps,cleanup:fn()}})},
  }
  const resolve=node=>{if(node==null||typeof node!=='object')return node;if(Array.isArray(node))return node.map(resolve);if(typeof node.type==='function')return resolve(node.type(node.props));return {...node,props:{...node.props,children:resolve(node.props.children)}}}
  const render=()=>{index=0;dirty=false;seat=resolve(component(props));const work=pending;pending=[];work.forEach(fn=>fn())}
  const unmount=()=>{cells.forEach(cell=>cell?.cleanup?.());cells.length=0;pending=[]}
  return {React,mount(fn,p){unmount();component=fn;props=p;render()},get seat(){return seat},async flush(){for(let i=0;i<40;i++){await Promise.resolve();if(dirty)render()}},render,unmount}
}
const walk=(node,out=[])=>{if(node==null)return out;if(Array.isArray(node)){node.forEach(n=>walk(n,out));return out}out.push(node);if(typeof node==='object')walk(node.props?.children,out);return out}
const text=node=>walk(node).filter(v=>typeof v==='string').join('')
globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{}
const sessionDrafts=new Map(),authorRunner=runner(),authorCalls=[]
let authorPost=deferred()
const author=createAuthorPanels({React:authorRunner.React,sessionDrafts,fetchState:async()=>({ok:true,sessionId:'s',recordVersions:{worldbook:{},cards:{}},worldbook:[],cards:[]}),invalidateState(){},saveState:async body=>{authorCalls.push(body);return authorPost.promise},runMaintenance:async()=>{},jsonFetch:async()=>({}),toast(){}})
async function assertDraftSurvivesRemount(Panel,buttonLabel,fieldType,kind){
  authorRunner.mount(Panel,{scope:{sessionId:'s'},visible:true});await authorRunner.flush()
  const add=walk(authorRunner.seat).find(n=>n?.type==='button'&&text(n).includes(buttonLabel));assert.ok(add);add.props.onClick();await authorRunner.flush()
  const save=walk(authorRunner.seat).find(n=>n?.type==='button'&&text(n)==='保存');assert.ok(save);save.props.onClick();await authorRunner.flush()
  assert.equal(walk(authorRunner.seat).find(n=>n?.type==='fieldset')?.props.disabled,true,`${fieldType} form locks during save`)
  authorRunner.mount(Panel,{scope:{sessionId:'s'},visible:true});await authorRunner.flush()
  const editable=walk(authorRunner.seat).find(n=>n?.type===fieldType);assert.ok(editable)
  editable.props.onChange({target:{value:'new draft'}});await authorRunner.flush()
  authorPost.resolve({recordVersions:{worldbook:{},cards:{}}});await authorRunner.flush()
  assert.equal(sessionDrafts.get(`s:${kind}`)?.dirty,true,`${fieldType} remount draft survives old response`)
  authorPost=deferred();sessionDrafts.clear()
}
await assertDraftSurvivesRemount(author.WorldbookPanel,'＋ 新增','textarea','worldbook')
await assertDraftSurvivesRemount(author.CardsPanel,'＋ 新增人物','textarea','cards')
const r=runner();let post=deferred();const toasts=[]
const personaData={schemaVersion:1,encoding:'native-account-persona-data-v1',revision:0,dataSha256:'a'.repeat(64),
  selectedId:'legacy.png',defaultId:null,avatarIds:['legacy.png'],profiles:[{avatar_id:'legacy.png',avatar:'legacy.png',
    name:'旧名',gender:'保密',title:'',description:'',position:0,depth:2,role:0,lorebook:'',connections:[],is_default:false}]}
const personaStorage=new Map()
const UserInfo=createUserInfoSettings({React:r.React,toast:message=>toasts.push(message),
  storage:{getItem:key=>personaStorage.get(key)??null,setItem:(key,value)=>personaStorage.set(key,value),removeItem:key=>personaStorage.delete(key)},
  fetch:async(_url,init)=>init?.method==='POST'?post.promise:{json:async()=>({ok:true,data:personaData})}})
r.mount(UserInfo,{});await r.flush()
const inputs=()=>walk(r.seat).filter(n=>n?.type==='input')
const save=()=>walk(r.seat).find(n=>n?.type==='button'&&text(n)==='保存当前角色')
assert.equal(inputs().length,3)
inputs()[0].props.onChange({target:{value:'新名'}});await r.flush();save().props.onClick();await r.flush()
assert.equal(inputs().every(n=>n.props.disabled===true),true,'userinfo fields lock while POST is pending')
post.reject(new Error('synthetic failure'));await r.flush()
assert.equal(inputs().every(n=>n.props.disabled===true),true,'an unconfirmed persona write retains its identity')
assert.match(toasts.at(-1),/结果尚未确认/)
walk(r.seat).find(n=>n?.type==='button'&&text(n)==='结束待确认操作').props.onClick();await r.flush()
assert.equal(inputs().every(n=>n.props.disabled!==true),true,'explicit recovery unlocks the unconfirmed draft')
assert.equal(inputs()[0].props.value,'新名')
console.log('author-save-ui=ok (fresh component mounts; save locks and explicit persona recovery)')

// Use the public factory and deterministic hooks to exercise the extracted pricing lifecycle.
const originalSetTimeout = globalThis.setTimeout, originalClearTimeout = globalThis.clearTimeout
const timers = new Map()
let timerId = 0
globalThis.setTimeout = fn => { const id = ++timerId; timers.set(id, fn); return id }
globalThis.clearTimeout = id => timers.delete(id)
const priceRunner = runner(), priceDrafts = new Map(), catalogCalls = [], priceWrites = [], priceToasts = []
let pricePost = deferred(), savedPrices = 0
const priceSettings = { currency: 'USD', revision: 7, defaultMode: 'manual', defaultMultiplier: 1, autoSync: false, rates: [] }
try {
  const {PricePanel} = createTelemetryPanels({
    React: priceRunner.React,
    sessionDrafts: priceDrafts,
    toast: message => priceToasts.push(message),
    jsonFetch: async (url, init) => {
      if (url.startsWith('/api/roleplay/price-catalog?')) {
        const pending = deferred(); catalogCalls.push({url, pending}); return pending.promise
      }
      if (init?.method === 'POST') { priceWrites.push(JSON.parse(init.body)); return pricePost.promise }
      return url.startsWith('/api/roleplay/prices?') ? {prices: priceSettings} : {catalog: []}
    },
  })
  priceRunner.mount(PricePanel, {sessionId: 'price-session', onSaved: () => { savedPrices++ }})
  await priceRunner.flush()
  assert.equal(timers.size, 1)
  const fireTimers = () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()) }
  fireTimers(); await priceRunner.flush()
  const search = () => walk(priceRunner.seat).find(node => node?.props?.placeholder === '搜索目录模型')
  search().props.onChange({target: {value: 'first'}}); await priceRunner.flush()
  search().props.onChange({target: {value: 'latest'}}); await priceRunner.flush()
  assert.equal(timers.size, 1, 'typing replaces the pending catalog debounce')
  fireTimers(); await priceRunner.flush()
  assert.equal(catalogCalls.length, 2)
  assert.equal(new URL(catalogCalls[1].url, 'https://fixture.test').searchParams.get('q'), 'latest')
  catalogCalls[1].pending.resolve({catalog: {source: 'latest-source'}, entries: []}); await priceRunner.flush()
  catalogCalls[0].pending.resolve({catalog: {source: 'stale-source'}, entries: []}); await priceRunner.flush()
  assert.ok(text(priceRunner.seat).includes('latest-source'))
  assert.ok(!text(priceRunner.seat).includes('stale-source'), 'late catalog response cannot replace current results')
  const multiplier = walk(priceRunner.seat).find(node => node?.type === 'input' && node.props.type === 'number')
  multiplier.props.onChange({target: {value: '3'}}); await priceRunner.flush()
  assert.equal(priceDrafts.get('price-session:prices').defaultMultiplier, 3)
  const savePrice = () => walk(priceRunner.seat).find(node => node?.type === 'button' && text(node) === '保存定价设置')
  savePrice().props.onClick(); await priceRunner.flush()
  assert.equal(priceWrites[0].expectedRevision, 7)
  assert.equal(walk(priceRunner.seat).find(node => node?.type === 'fieldset').props.disabled, true)
  pricePost.reject(new Error('price-save-failed')); await priceRunner.flush()
  assert.equal(priceDrafts.get('price-session:prices').defaultMultiplier, 3)
  assert.equal(priceToasts.at(-1), 'price-save-failed')
  pricePost = deferred(); savePrice().props.onClick(); await priceRunner.flush()
  pricePost.resolve({prices: {...priceSettings, revision: 8, defaultMultiplier: 3}}); await priceRunner.flush()
  assert.equal(priceDrafts.has('price-session:prices'), false)
  assert.equal(savedPrices, 1)
  search().props.onChange({target: {value: 'cleanup'}}); await priceRunner.flush()
  assert.equal(timers.size, 1)
  priceRunner.unmount()
  assert.equal(timers.size, 0, 'unmount clears the pricing debounce')
  console.log('pricing-panel=ok (public factory, debounce, stale response, draft/CAS, failure, cleanup)')
} finally {
  priceRunner.unmount()
  globalThis.setTimeout = originalSetTimeout
  globalThis.clearTimeout = originalClearTimeout
}
