import assert from 'node:assert/strict'
import {createPresetPanel,presetConversationChoices} from '../lib/ui/preset-panel.js'
import {createNarrativePresets,BLANK_PRESET} from '../lib/core/narrative-presets.js'

const catalog={schemaVersion:1,worldlines:{'fork-a':{conversationId:'a',status:'ready'}},conversations:{a:{activeSessionId:'fork-a'}}}
assert.deepEqual(presetConversationChoices({ids:['a','fork-a','b','background-subagent','standard'],byId:{a:{title:'First story'},'fork-a':{},b:{displayTitle:'Second story',parentId:'source-root'},'background-subagent':{title:'{"taskId":"maintenance"}',origin:'subagent',parentId:'a',projectionValues:{agentPreset:'roleplay'}},standard:{}}},catalog,id=>['a','b','background-subagent'].includes(id)),[{id:'fork-a',label:'First story'},{id:'b',label:'Second story'}],'native root metadata works before active fork metadata hydrates; subagent origins are excluded while a parent-linked independent clone remains visible')

function renderer() {
  const instances=new Map();let current,root,props,seat,dirty=false,effects=[],seen
  const equal=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>Object.is(v,b[i]))
  const React={
    createElement:(type,props,...children)=>({type,props:{...props,children}}),
    useState(initial){const owner=current,id=owner.index++;owner.cells[id]??={value:typeof initial==='function'?initial():initial};return [owner.cells[id].value,next=>{const cell=owner.cells[id],value=typeof next==='function'?next(cell.value):next;if(!Object.is(value,cell.value)){cell.value=value;dirty=true}}]},
    useRef(value){const id=current.index++;return current.cells[id]??={current:value}},
    useEffect(fn,deps){const owner=current,id=owner.index++,old=owner.cells[id];if(!equal(old?.deps,deps))effects.push(()=>{old?.cleanup?.();owner.cells[id]={deps,cleanup:fn()}})},
  }
  function resolve(node,path='root') {
    if(Array.isArray(node))return node.map((child,i)=>resolve(child,`${path}/${i}`))
    if(!node||typeof node!=='object')return node
    if(typeof node.type==='function'){
      const key=`${path}/${node.type.name}:${node.props.key??''}`;seen.add(key)
      const owner=instances.get(key)??{cells:[],index:0};instances.set(key,owner);owner.index=0;current=owner
      return resolve(node.type(node.props),`${key}/body`)
    }
    return {...node,props:{...node.props,children:resolve(node.props.children,`${path}/children`)}}
  }
  const render=()=>{dirty=false;seen=new Set();seat=resolve(React.createElement(root,props));for(const [key,owner] of instances)if(!seen.has(key)){owner.cells.forEach(c=>c?.cleanup?.());instances.delete(key)}const work=effects;effects=[];work.forEach(fn=>fn())}
  return {React,mount(fn,p){root=fn;props=p;render()},get seat(){return seat},async flush(){for(let i=0;i<80;i++){await Promise.resolve();if(dirty)render()}}}
}
const nodes=(n,out=[])=>{if(Array.isArray(n))n.forEach(c=>nodes(c,out));else if(n!=null){out.push(n);if(typeof n==='object')nodes(n.props.children,out)}return out}
const text=n=>nodes(n).filter(x=>typeof x==='string').join('')
const table=new Map();table.put=async(k,v)=>table.set(k,structuredClone(v))
const store=createNarrativePresets(table,id=>id==='a-fork'?'a':id),calls=[]
let nextGet=null
const runner=renderer()
const Panel=createPresetPanel({React:runner.React,toast(){},confirmWithDialog:async()=>true,conversations:async()=>[{id:'b',label:'第二个故事'}],jsonFetch:async(url,init)=>{
  const body=init?JSON.parse(init.body):null;calls.push({url,body})
  if(!body&&nextGet){const result=nextGet;nextGet=null;return result}
  return body?store.mutate(body.sessionId,body):store.policy(new URL(url,'https://fixture').searchParams.get('sessionId'))
}})
globalThis.document={}
const field=label=>nodes(runner.seat).find(n=>n?.props?.['aria-label']===label)
const button=label=>nodes(runner.seat).find(n=>n?.type==='button'&&text(n)===label)
const change=async(label,value)=>{const input=field(label);assert.ok(input);assert.ok(!input.props.disabled,label+' enabled');input.props.onChange({target:{value}});await runner.flush()}
const click=async label=>{const b=button(label);assert.ok(b,label);assert.ok(!b.props.disabled,label+' enabled');b.props.onClick();await runner.flush()}
runner.mount(Panel,{sessionId:'a-fork'});await runner.flush()
assert.equal(field('生效范围').props.value,'current')
assert.equal(field('顶层创作提示词').props.readOnly,true)
assert.equal(button('修改预设').props.disabled,true);assert.equal(button('删除预设').props.disabled,true)
await click('新增预设');await change('预设名称','清简');await change('顶层创作提示词','短句，少用修饰。')
assert.equal(field('生效范围').props.disabled,true,'scope locked until draft is saved or discarded')
await click('保存预设');const custom=store.read().presets.at(-1).id
assert.equal(field('选择预设').props.value,custom);assert.notEqual(store.policy('a').effective.presetId,custom,'saving library does not implicitly activate')
await change('文风模式','blend');await click('应用到所选范围')
assert.equal(store.policy('a').effective.presetId,custom);assert.equal(store.policy('a').effective.mode,'blend')
await click('修改预设');await change('顶层创作提示词','新正文')
// Another page saved first: keep the unsaved draft and show the CAS error.
await store.mutate('b',{expectedRevision:store.read().revision,action:'create',preset:{name:'Other',text:''}})
await click('保存预设');assert.equal(field('顶层创作提示词').props.value,'新正文');assert.match(text(runner.seat),/已更新/)
await click('取消编辑');await click('刷新预设')
await change('生效范围','target');await change('指定对话','b')
await change('选择预设',BLANK_PRESET);await change('文风模式','card');await click('应用到所选范围')
assert.equal(calls.at(-1).body.sessionId,'b');assert.equal(calls.at(-1).body.scope,'conversation')
assert.equal(store.policy('b').effective.mode,'card');assert.equal(store.policy('a').effective.mode,'blend')
await change('生效范围','global');await change('选择预设',BLANK_PRESET);await click('应用到所选范围')
assert.equal(store.policy('new-conversation').effective.presetId,BLANK_PRESET);assert.equal(store.policy('a').effective.presetId,custom)
await change('生效范围','current');await click('清除对话覆盖，沿用全局')
assert.equal(store.policy('a').local,null);assert.equal(store.policy('a-fork').effective.presetId,BLANK_PRESET)
await change('选择预设',custom);await click('删除预设');assert.ok(!store.read().presets.some(p=>p.id===custom))
assert.equal(field('顶层创作提示词').props.value,'')
await change('选择预设','system-light-novel')
const systemText=field('顶层创作提示词').props.value
assert.ok(systemText.includes('## 七、写作检查清单'))
assert.equal(button('修改预设').props.disabled,true)
await click('另存副本');await change('预设名称','轻小说自定义副本');await click('保存预设')
const copied=store.read().presets.at(-1)
assert.equal(copied.text,systemText);assert.equal(copied.readonly,false)
await click('修改预设');await change('顶层创作提示词',systemText+'\n自定义收尾要求。');await click('保存预设')
assert.equal(store.read().presets.find(p=>p.id==='system-light-novel').text,systemText,'editing a copied system style never changes the built-in original')
console.log('narrative-presets-ui=ok (real component hooks: immutable defaults, create, apply, edits/CAS, designated/current/global scopes, inheritance, delete, blank)')
