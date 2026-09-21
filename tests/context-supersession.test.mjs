import assert from 'node:assert/strict'
import * as core from '../lib/core/roleplay-core.js'

assert.equal(typeof core.retireRoleplayContexts,'function','context retention remains a native policy boundary')
const session={id:'selected-branch',events:[],surface:{nodes:[]},seq:0}
session.append=(type,data,options={})=>{
  const e={type,data:structuredClone(data),seq:session.seq++,...options}
  session.events.push(e)
  if(options.surfaceOp==='append')session.surface.nodes.push(e.seq)
  else if(options.surfaceOp?.op==='replace') {
    const i=session.surface.nodes.indexOf(options.surfaceOp.start)
    assert.ok(i>=0)
    assert.deepEqual(options.sourceEventSeqs,[options.surfaceOp.start])
    assert.equal(options.surfaceOp.start,options.surfaceOp.end,'never span across real story or tool events')
    session.surface.nodes.splice(i,1,e.seq)
  }
  return e
}
const append=(source,text)=>session.append('user/message',{id:String(session.seq),role:'user',source,content:[{type:'text',text}]},{surfaceOp:'append'})
const first=append({kind:'plugin',plugin:'roleplay-context',form:'context'},'FULL_FIXED_SETTING_OLD_1')
const user=append({kind:'user'},'Player intent')
const tool=session.append('tool/result',{message:{role:'tool',content:[{type:'text',text:'tool result'}]}},{surfaceOp:'append'})
const second=append({kind:'plugin',plugin:'roleplay-context',form:'context'},'FULL_FIXED_SETTING_OLD_2')
const unselected=append({kind:'plugin',plugin:'roleplay-context',form:'context'},'SIBLING_CONTEXT')
session.surface.nodes.pop()
const ordinary=append({kind:'user'},'A user literally mentions roleplay-context')
const audit=structuredClone(session.events)
const prefix=[...session.surface.nodes]
assert.equal(core.retireRoleplayContexts(session,3),0,'ordinary turns preserve prior hidden-context bytes for prompt caching')
assert.deepEqual(session.events,audit,'context retention never adds a replacement receipt')
assert.deepEqual(session.surface.nodes,prefix,'ordinary turns preserve the complete visible prefix')
assert.ok(session.surface.nodes.includes(user.seq)&&session.surface.nodes.includes(tool.seq)&&session.surface.nodes.includes(ordinary.seq))
assert.equal(core.retireRoleplayContexts(session,3),0,'retry is also a no-op')
assert.deepEqual(session.events[unselected.seq],audit[unselected.seq])
append({kind:'plugin',plugin:'roleplay-context',form:'director-notes',branchId:session.id,notesHash:'new'},'FULL_CURRENT_FIXED_SETTING_AND_RECALL')
const visible=session.surface.nodes.map(seq=>session.events[seq])
assert.equal(visible.filter(e=>e.data?.source?.plugin==='roleplay-context').length,3)
assert.ok(JSON.stringify(visible).includes('FULL_FIXED_SETTING_OLD'))
assert.ok(JSON.stringify(visible).includes('FULL_CURRENT_FIXED_SETTING_AND_RECALL'))
// Only a successfully prepared replacement can retire a dynamic snapshot.
// Unchanged notes retain their exact full anchor, while obsolete state and
// redundant references leave the model surface without touching audit bytes.
const dynamic=(form,hash,mode,branchId=session.id)=>({kind:'plugin',plugin:'roleplay-context',schemaVersion:1,form,branchId,mode,[form==='state'?'stateHash':'notesHash']:hash.repeat(64)})
const oldNotes=append(dynamic('director-notes','a','full'),'OLD_NOTES_PAYLOAD')
const notes=append(dynamic('director-notes','b','full'),'CURRENT_NOTES_PAYLOAD')
const ref=append(dynamic('director-notes','b','reference'),'OLD_REFERENCE')
const oldState=append(dynamic('state','c','full'),'OLD_STATE_PAYLOAD')
const foreign=append(dynamic('state','c','full','parent-branch'),'PARENT_STATE_PAYLOAD')
const future=[{source:dynamic('director-notes','b','reference'),content:[{type:'text',text:'CURRENT_REFERENCE'}]},
 {source:dynamic('state','d','full'),content:[{type:'text',text:'NEW_STATE_PAYLOAD'}]}]
const before=structuredClone(session.events),beforeCount=session.events.length
assert.equal(core.retireRoleplayContexts(session,4,future),4)
assert.ok(session.surface.nodes.includes(notes.seq),'exact full anchor backing the new reference remains')
for(const e of [oldNotes,ref,oldState,foreign])assert.ok(!session.surface.nodes.includes(e.seq))
assert.deepEqual(session.events.slice(0,beforeCount),before,'retirement is append-only')
assert.equal(core.retireRoleplayContexts(session,4,future),0,'retry adds no duplicate receipts')
const dangling=[{source:dynamic('director-notes','e','reference'),content:[{type:'text',text:'missing full anchor'}]}]
assert.equal(core.retireRoleplayContexts(session,4,dangling),0,'unresolved replacement cannot remove current notes')
assert.ok(session.surface.nodes.includes(notes.seq))
assert.equal(core.retireRoleplayContexts(session,4,[{...future[1],source:dynamic('state','e','full','unselected')}]),0,'foreign prepared anchor cannot retire current context')
// A hard-window continuation may receive native derived history.  Keep only
// selected story messages: maintenance assistant/tool pairs are identified by
// their phase provenance and call ids, never by their text.
const windowSession={id:'window-branch',events:[],surface:{nodes:[]}}
const addWindow=(type,data)=>{const event={seq:windowSession.events.length,type,data};windowSession.events.push(event);windowSession.surface.nodes.push(event.seq);return event}
addWindow('turn/start',{turn:1})
addWindow('user/message',{id:'prepare',source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'prepare'},content:[]})
addWindow('assistant/message',{turn:1,message:{id:'maintenance-call',content:[{type:'tool-call',id:'maintenance-call-id',name:'rp_task_submit',arguments:'{}'}]}})
addWindow('tool/call',{turn:1,callId:'maintenance-call-id',name:'rp_task_submit'})
addWindow('tool/result',{turn:1,message:{id:'maintenance-result',role:'tool',source:{kind:'tool',callId:'maintenance-call-id'},content:[{type:'text',text:'LARGE_MAINTENANCE_RESULT'}]}})
addWindow('user/message',{id:'story-phase',source:{kind:'plugin',plugin:'roleplay-tasks',form:'phase',stage:'story'},content:[]})
addWindow('user/message',{id:'old-player',source:{kind:'user'},content:[{type:'text',text:'OLD_PLAYER'}]})
addWindow('assistant/message',{turn:1,message:{id:'old-story',content:[{type:'text',text:'OLD_STORY'}]}})
const derived=[
 {id:'maintenance-call',role:'assistant',content:[{type:'tool-call',id:'maintenance-call-id',name:'rp_task_submit',arguments:'{}'}]},
 {id:'maintenance-result',role:'tool',source:{kind:'tool',callId:'maintenance-call-id'},content:[{type:'text',text:'LARGE_MAINTENANCE_RESULT'}]},
 {id:'ordinary-tool-call',role:'assistant',content:[{type:'tool-call',id:'ordinary-call-id',name:'rp_history',arguments:'{}'}]},
 {id:'ordinary-tool-result',role:'tool',source:{kind:'tool',callId:'ordinary-call-id'},content:[{type:'text',text:'OLD_TOOL_RESULT'}]},
 {id:'old-player',role:'user',source:{kind:'user'},content:[{type:'text',text:'OLD_PLAYER'}]},
 {id:'old-story',role:'assistant',content:[{type:'text',text:'OLD_STORY'}]},
]
const continuity=core.retainRoleplayWindowContinuity(windowSession,derived,1000)
assert.deepEqual(continuity.map(message=>message.id),['old-player','old-story'])
const anchors=[
 {type:'user/message',data:{source:{kind:'plugin',plugin:'roleplay-context',form:'director-notes'}}},
 {type:'user/message',data:{source:{kind:'plugin',plugin:'roleplay-context',form:'state'}}},
 {type:'user/message',data:{source:{kind:'user'}}},
]
assert.equal(core.roleplayWindowCutStartIndex(anchors,2),0,'the first old-window anchors leave with their first story input')
if(process.env.DSH_NATIVE_SESSION_MODULE){
 const {Session}=await import(process.env.DSH_NATIVE_SESSION_MODULE)
 const native=Session.create('dynamic-context-native')
 const source=(form,n,mode)=>({kind:'plugin',plugin:'roleplay-context',schemaVersion:1,branchId:native.id,form,mode,[form==='state'?'stateHash':'notesHash']:n.toString(16).padStart(64,'0')})
 const add=(id,src,value)=>native.append('user/message',{id,role:'user',source:src,content:[{type:'text',text:value}]},{surfaceOp:'append'})
 for(let turn=1;turn<=15;turn++){
  const noteVersion=Math.ceil(turn/3),full=turn%3===1
  const messages=[{source:source('director-notes',noteVersion,full?'full':'reference'),content:[{type:'text',text:full?`NOTES_${noteVersion}_PAYLOAD`:'reference'}]},
   {source:source('state',turn,'full'),content:[{type:'text',text:`STATE_${turn}_PAYLOAD`}]}]
  const before=JSON.stringify(native.events),length=native.events.length
  core.retireRoleplayContexts(native,turn,messages)
  assert.equal(JSON.stringify(native.events.slice(0,length)),before)
  messages.forEach((m,i)=>add(`anchor-${turn}-${i}`,m.source,m.content[0].text))
  add(`player-${turn}`,{kind:'user'},`PLAYER_${turn}`)
  const derived=JSON.stringify(native.deriveMessages())
  assert.ok(derived.includes(`NOTES_${noteVersion}_PAYLOAD`))
  assert.ok(derived.includes(`STATE_${turn}_PAYLOAD`))
  if(turn>1)assert.ok(!derived.includes(`STATE_${turn-1}_PAYLOAD`))
  if(noteVersion>1)assert.ok(!derived.includes(`NOTES_${noteVersion-1}_PAYLOAD`))
  assert.ok(derived.includes('PLAYER_1'),'ordinary player history is not a dynamic snapshot')
 }
}
console.log('context-supersession=ok (bounded dynamic anchors; unchanged full backing and append-only audit retained)')
