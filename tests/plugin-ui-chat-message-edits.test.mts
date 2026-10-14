/** Real alpha7 assembler and owned Chat builders; no Harness, DOM or model calls. */
import assert from 'node:assert/strict'
import {after, test} from 'node:test'
import {createRequire} from 'node:module'
import {readFile, writeFile} from 'node:fs/promises'
import {existsSync} from 'node:fs'
import {fileURLToPath, pathToFileURL} from 'node:url'
import path from 'node:path'
import {createTestDirectory, cleanupTestDirectory} from '../src/operations/test-temp.mts'

const require = createRequire(new URL('../build-tools/package.json', import.meta.url))
const directory = createTestDirectory('ui-chat-projections-')
after(() => cleanupTestDirectory(directory))
const {build} = require('esbuild')
const compat = fileURLToPath(new URL(existsSync(new URL('../compat/',import.meta.url)) ? '../compat/' : '../development/', import.meta.url))
async function loadOwned(entry: string) {
  const result = await build({entryPoints:[path.join(compat,'ui-chat/lib/client',entry+'.js')],
    bundle:true,format:'esm',platform:'node',write:false,
    plugins:[{name:'single-locked-peer',setup(b: any) {
      b.onResolve({filter:/^@deepseek-ai\//}, (args: any) => ({path:pathToFileURL(require.resolve(args.path)).href,external:true}))
      b.onResolve({filter:/^dsh-nexttavern-session-format\/projection$/}, () => ({path:path.join(compat,'session-format/lib/projection.js')}))
      b.onResolve({filter:/^dsh-nexttavern-token-meter\/client$/}, () => ({path:path.join(compat,'token-meter/lib/client.js')}))
    }}]})
  const output = path.join(directory,path.basename(entry)+'.mjs')
  await writeFile(output,result.outputFiles[0].text)
  return import(pathToFileURL(output).href)
}
const modules = await Promise.all(['message','message-edits','assistant','turn-process','turn-tail','chat-snapshot-builder']
  .map(name => loadOwned('conversation-nodes/'+name)))
const [message, edits, assistant, processNodes, tail, chat] = modules
const rail = await loadOwned('chat/turn-rail-items')
let registration: any
const nativeBundle = await readFile(require.resolve('@deepseek-ai/dsh-client-ui-conversation/client'),'utf8')
new Function('window',nativeBundle)({__ModuleLoader__:{load(value: any) {registration=value}}})
const native = registration.factory((name: string) => {
  // Only visual primitives are absent. Any invocation would fail; the real
  // assembler, locations, stores, definitions and publication are untouched.
  if (name === '@deepseek-ai/dsh-client-ui-primitives') return {}
  return require(name)
})
const definitions = [message.messageDefinition, edits.messageEditDefinition, assistant.assistantDefinition,
  processNodes.turnProcessDefinition, tail.turnTailDefinition]
function engine() {
  const assembler = new native.ConversationNodeAssembler({entries:()=>definitions,fallbackEntry:()=>undefined},
    {entries:()=>[chat.chatViewDefinition]})
  assembler.activateTarget('chat')
  return assembler
}
function event(seq: number, type: string, data: any, extra: any = {}) {
  return {seq,type,data,time:1_000+seq, ...extra}
}
function fixture() {
  const usage = {inputTokens:30,outputTokens:7,totalTokens:37}
  const journal = [
    event(0,'turn/start',{turn:1}),
    event(1,'user/message',{id:'u1',role:'user',source:{kind:'user',rpcId:'rpc1'},content:[{type:'text',text:'old prompt'}]}, {surfaceOp:'append'}),
    event(2,'step/start',{turn:1,step:1}),
    event(3,'assistant/message',{turn:1,step:1,usage,stream:[{type:'chunk',time:1003,chunk:{type:'usage',usage}}],message:{id:'a1',role:'assistant',source:{kind:'model',provider:'fixture',model:'fixture'},content:[
      {type:'reasoning',text:'private reasoning'}, {type:'text',text:'old answer'}]}},{surfaceOp:'append'}),
    event(4,'step/end',{turn:1,step:1,reason:{kind:'completed'}}),
    event(5,'turn/end',{turn:1,reason:{kind:'completed'}}),
  ]
  return {journal,usage}
}
function edit(seq: number, targetSeq: number, role: string, messageId: string, text: string) {
  return event(seq,'roleplay/message-edit',{schemaVersion:1,targetSeq,role,messageId,text})
}
const records = (journal: any[]) => journal.map(event => ({type:'event',event}))
const get = (snapshot: any, kind: string) => snapshot.nodes.values().find((node: any) => node.kind === kind)
const prose = (node: any) => (node.data.content ?? node.data.blocks).filter((block: any) =>
  block.type === 'text' || block.kind === 'text').map((block: any) => block.text).join('')

test('native programmatic opening assembles the chat and turn tail without billed usage', () => {
  const {journal} = fixture()
  const opening = 'Authored opening\r\nwith trailing spaces.  '
  journal[3] = event(3,'assistant/message',{turn:1,step:1,stream:[],message:{
    id:'opening-1',role:'assistant',source:{kind:'programmatic',schemaVersion:1,
      producer:'dsh-nexttavern',origin:'card-opening:fixture',operationId:'opening-operation-1'},
    content:[{type:'text',text:opening}]}},{surfaceOp:'append'})
  const actual = engine()
  actual.replaceWindow(records(journal),false)
  actual.flush()
  const snapshot = actual.snapshot('chat')
  assert.equal(prose(get(snapshot,'assistant-step')),opening)
  assert.equal(prose({data:{blocks:get(snapshot,'turn-tail').data.closing.blocks}}),opening)
  assert.equal(get(snapshot,'turn-tail').data.tokenUsage,undefined)
})

test('native cold assembly applies required edits to chat, tail, navigation and legacy without rewriting billing', () => {
  const {journal,usage} = fixture()
  const original = JSON.stringify(journal)
  const a = engine()
  a.replaceWindow(records([...journal,edit(6,1,'user','u1','new prompt'),edit(7,3,'assistant','a1','new answer')]),false)
  a.flush()
  const s = a.snapshot('chat')
  assert.equal(prose(get(s,'user')),'new prompt')
  const answer = get(s,'assistant-step')
  assert.equal(prose(answer),'new answer')
  assert.equal(answer.data.finalNode.seq,3)
  assert.equal(answer.data.finalNode.messageId,'a1')
  assert.deepEqual(answer.data.finalNode.usage,usage)
  assert.equal(answer.data.blocks.find((b: any) => b.kind === 'reasoning').text,'private reasoning')
  assert.equal(get(s,'turn-tail').data.closing.blocks.find((b: any) => b.kind === 'text').text,'new answer')
  assert.equal(s.navigation.items()[0].response,'new answer')
  assert.equal(s.navigation.items()[0].prompt,'new prompt')
  assert.equal(s.legacy.nodes.find((n: any) => n.kind === 'assistant').blocks.find((b: any) => b.kind === 'text').text,'new answer')
  assert.equal(s.nodes.values().some((n: any) => n.kind === 'message-edit'),false)
  assert.equal(JSON.stringify(journal),original)
})

test('native live edits notify target subscribers, retain process currency and ignore older decisions on paging', () => {
  const {journal} = fixture()
  const a = engine()
  a.replaceWindow(records(journal),false); a.flush()
  const before = a.snapshot('chat')
  const answer = get(before,'assistant-step')
  const source = before.nodes.source(answer.key)
  let notifications = 0
  const release = source.subscribe(() => notifications++)
  const processBefore = get(before,'turn-process')?.data
  a.append(records([edit(6,3,'assistant','a1','edited live')])[0]); a.flush()
  const afterEdit = a.snapshot('chat')
  assert.equal(prose(get(afterEdit,'assistant-step')),'edited live')
  assert.equal(notifications,1)
  assert.deepEqual(get(afterEdit,'turn-process')?.data,processBefore)
  a.append(records([edit(7,3,'assistant','a1','newest')])[0]); a.flush()
  assert.equal(prose(get(a.snapshot('chat'),'assistant-step')),'newest')
  release()
})

test('native tail window waits for the real target then preserves newest edit across prepend and resync', () => {
  const {journal} = fixture()
  const decision = edit(6,3,'assistant','a1','paged answer')
  const a = engine()
  a.replaceWindow(records([decision]),true); a.flush()
  assert.equal(get(a.snapshot('chat'),'assistant-step'),undefined)
  a.prepend(records(journal),false); a.flush()
  assert.equal(prose(get(a.snapshot('chat'),'assistant-step')),'paged answer')
  a.replaceWindow(records([...journal,decision]),false); a.flush()
  assert.equal(prose(get(a.snapshot('chat'),'assistant-step')),'paged answer')
})

test('required edit rejects malformed version, ignorable admission and mismatched message identity', () => {
  const {journal} = fixture()
  for (const bad of [
    {...edit(6,3,'assistant','a1','bad'),ignorable:true},
    edit(6,3,'assistant','wrong-id','bad'),
    {...edit(6,3,'assistant','a1','bad'),data:{...edit(6,3,'assistant','a1','bad').data,schemaVersion:9}},
  ]) {
    const a = engine()
    assert.throws(() => {a.replaceWindow(records([...journal,bad]),false);a.flush()}, /edit|version|identity/i)
  }
})

test('one edit invalidates only its own nodes in a long materialized transcript', () => {
  const builder = new chat.ChatSnapshotBuilder()
  const timeline = {turnOrder:[],turns:new Map()}
  const rows = Array.from({length:20_000},(_,i) => ({key:'u'+i,id:'u'+i,target:'chat',kind:'user',anchorSeq:i,
    visibility:'visible',location:{kind:'session'},data:{kind:'user',seq:i,time:i,messageId:'u'+i,content:[{type:'text',text:'old'}]}}))
  const initial = builder.replace({nodes:rows,timeline})
  const untouched = initial.nodes.get('u1')
  const result = builder.apply({upserts:[{key:'edit',id:'edit',target:'chat',kind:'message-edit',anchorSeq:19_999,
    visibility:'hidden',location:{kind:'session'},data:{...edit(20_001,19_999,'user','u19999','changed').data,editSeq:20_001}}],timeline})
  assert.equal(prose(result.nodes.get('u19999')),'changed')
  assert.equal(result.nodes.get('u1'),untouched)
  assert.equal(builder.groupInput().changes.length,1,'no all-history repaint for a content-only edit')
})

test('native phase evidence keeps story and maintenance separate through cold, live and partial windows', () => {
  const {journal,usage} = fixture()
  const phase = event(5,'user/message',{id:'phase',role:'user',content:[{type:'text',text:'maintenance'}],
    source:{kind:'roleplay-tasks',form:'phase',schemaVersion:1,stage:'after-story',turn:1,storySeq:3}}, {surfaceOp:'append'})
  const later = [phase,event(6,'step/start',{turn:1,step:2}),
    event(7,'assistant/message',{turn:1,step:2,usage,stream:[],message:{id:'maintenance-tools',role:'assistant',
      source:{kind:'model',provider:'fixture',model:'fixture'},content:[
        {type:'reasoning',text:'maintenance reasoning'},
        {type:'tool-call',id:'maintenance-call',name:'rp_setting',arguments:'{"operation":"fixture"}'},
      ]}},{surfaceOp:'append'}),
    event(8,'step/end',{turn:1,step:2,reason:{kind:'completed'}}),event(9,'step/start',{turn:1,step:3}),
    event(10,'assistant/message',{turn:1,step:3,usage,stream:[],message:{id:'maintenance-report',role:'assistant',
      source:{kind:'model',provider:'fixture',model:'fixture'},content:[{type:'text',text:'maintenance report'}]}},{surfaceOp:'append'}),
    event(11,'step/end',{turn:1,step:3,reason:{kind:'completed'}}),event(12,'turn/end',{turn:1,reason:{kind:'completed'}})]
  const whole = [...journal.slice(0,5),...later]
  const outline = [{turn:1,seq:0,prompt:'old prompt',response:'maintenance report'}]
  for (const live of [false,true]) {
    const a = engine()
    a.replaceWindow(records(live ? whole.slice(0,5) : whole),false);a.flush()
    if (live) for (const record of records(later)) {
      a.append(record);a.flush()
      assert.equal(a.snapshot('chat').navigation.items()[0].response,'old answer',
        'the existing phase keeps the live preview on Story during maintenance')
    }
    const s = a.snapshot('chat')
    assert.equal(get(s,'turn-tail').data.closing.finalNode.messageId,'a1')
    assert.equal(get(s,'turn-process').data.answerAnchorSeq,3)
    assert.equal(get(s,'turn-process').data.maintenanceStartSeq,5)
    assert.equal(get(s,'turn-process').data.messageCount,1)
    assert.equal(s.navigation.items()[0].response,'old answer')
    assert.equal(rail.mergeTurnRailItems(s.navigation.items(),outline)[0].response,'old answer')
  }
  const partial = engine()
  partial.replaceWindow(records(later.slice(0,-1)),true);partial.flush()
  const runningPartial = partial.snapshot('chat')
  const runningLocation = get(runningPartial,'assistant-step').location
  assert.equal(runningLocation.turn.data.get('turn-process').roleplayAnswer,true,
    'the existing Turn data owns its Story even when the process view is outside the partial Location index')
  assert.equal(runningPartial.navigation.items()[0].response,'',
    'a running partial window never substitutes maintenance for its missing Story')
  assert.equal(rail.mergeTurnRailItems(runningPartial.navigation.items(),outline)[0].response,'')
  partial.append(records(later.slice(-1))[0]);partial.flush()
  const closedPartial = partial.snapshot('chat')
  assert.equal(get(closedPartial,'turn-tail').data.closing,null,'missing original never becomes maintenance prose')
  assert.equal(closedPartial.navigation.items()[0].response,'')
  assert.equal(rail.mergeTurnRailItems(closedPartial.navigation.items(),outline)[0].response,'',
    'the known empty Story preview cannot borrow the outline maintenance response')
  partial.prepend(records(journal.slice(0,5)),false);partial.flush()
  const restored = partial.snapshot('chat')
  assert.equal(get(restored,'turn-tail').data.closing.finalNode.messageId,'a1')
  assert.equal(restored.navigation.items()[0].response,'old answer')
  assert.equal(rail.mergeTurnRailItems(restored.navigation.items(),outline)[0].response,'old answer')
  assert.equal(rail.mergeTurnRailItems([],outline)[0].response,'maintenance report',
    'a completely unloaded outline still belongs to its unchanged Host owner')
  const ordinary = engine()
  const ordinaryPhase = {...phase,data:{...phase.data,source:{kind:'user',rpcId:'ordinary-followup'}}}
  ordinary.replaceWindow(records([...journal.slice(0,5),ordinaryPhase,...later.slice(1)]),false);ordinary.flush()
  assert.equal(ordinary.snapshot('chat').navigation.items()[0].response,'maintenance report',
    'without a Roleplay phase, the ordinary latest-text preview is unchanged')
})

test('model-only replacement cannot change the transcript assistant identity', () => {
  const {journal} = fixture()
  const replacement = {...journal[3],seq:6,surfaceOp:{op:'replace',startSeq:3,endSeq:3}}
  assert.equal(assistant.assistantDefinition.match(replacement),null)
  const state = assistant.assistantDefinition.start({}, {event:journal[2]})
  const updated = assistant.assistantDefinition.update({state},{event:replacement})
  assert.equal(updated,state,'direct replay also refuses replacement settlement')
})
