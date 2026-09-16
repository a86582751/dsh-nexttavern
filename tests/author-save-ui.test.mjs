import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createAuthorPanels} from '../src/author-panels.js'
import {createUserInfoSettings} from '../src/user-info.js'

const authorSource=readFileSync(new URL('../src/author-panels.ts',import.meta.url),'utf8')
assert.equal((authorSource.match(/React\.createElement\('fieldset', \{ disabled: saving/g)??[]).length,2,'worldbook and card editors disable their complete form while saving')

function deferred(){let resolve,reject;const promise=new Promise((res,rej)=>{resolve=res;reject=rej});return {promise,resolve,reject}}
function runner(){
  const cells=[];let index=0,dirty=false,pending=[],component,props,seat
  const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]))
  const React={
    createElement:(type,props,...children)=>({type,props:{...(props??{}),children}}),
    useState(initial){const id=index++;cells[id]??={value:typeof initial==='function'?initial():initial};return [cells[id].value,next=>{const value=typeof next==='function'?next(cells[id].value):next;if(!Object.is(value,cells[id].value)){cells[id].value=value;dirty=true}}]},
    useRef(value){const id=index++;return cells[id]??={current:value}},
    useEffect(fn,deps){const id=index++,old=cells[id];if(!same(old?.deps,deps))pending.push(()=>{old?.cleanup?.();cells[id]={deps,cleanup:fn()}})},
  }
  const resolve=node=>{if(node==null||typeof node!=='object')return node;if(Array.isArray(node))return node.map(resolve);if(typeof node.type==='function')return resolve(node.type(node.props));return {...node,props:{...node.props,children:resolve(node.props.children)}}}
  const render=()=>{index=0;dirty=false;seat=resolve(component(props));const work=pending;pending=[];work.forEach(fn=>fn())}
  return {React,mount(fn,p){component=fn;props=p;render()},get seat(){return seat},async flush(){for(let i=0;i<40;i++){await Promise.resolve();if(dirty)render()}},render}
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
globalThis.fetch=async(_url,init)=>init?.method==='POST'?post.promise:{json:async()=>({ok:true,userinfo:{name:'旧名',gender:'保密'}})}
const UserInfo=createUserInfoSettings({React:r.React,toast:message=>toasts.push(message)})
r.mount(UserInfo,{});await r.flush()
const inputs=()=>walk(r.seat).filter(n=>n?.type==='input')
const save=()=>walk(r.seat).find(n=>n?.type==='button'&&text(n)==='保存')
assert.equal(inputs().length,2)
inputs()[0].props.onChange({target:{value:'新名'}});await r.flush();save().props.onClick();await r.flush()
assert.equal(inputs().every(n=>n.props.disabled===true),true,'userinfo fields lock while POST is pending')
post.reject(new Error('synthetic failure'));await r.flush()
assert.equal(inputs().every(n=>n.props.disabled!==true),true,'userinfo fields unlock after a failed POST')
assert.match(toasts.at(-1),/保存失败/)
console.log('author-save-ui=ok (worldbook/cards fieldset lock; userinfo deferred failure unlock)')
