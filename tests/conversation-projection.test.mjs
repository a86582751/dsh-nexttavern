import assert from 'node:assert/strict'
import { projectConversationList, projectConversationWorkspaces,projectConversationSearch,resolveConversationExecution } from '../lib/ui/conversation-projection.js'

const catalog = {
  schemaVersion: 1,
  worldlines: {
    childA: { conversationId: 'root', status: 'ready' },
    childB: { conversationId: 'root', status: 'reserved' },
    independentChild: { conversationId: 'independentChild', status: 'ready' },
  },
  conversations: { root: { activeSessionId: 'childA' } },
}

{
  const projectionValues = { contextTimeline: [{ seq: 1, text: 'shared' }] }
  const native = {
    ids: ['root', 'childA', 'childB', 'independent', 'independentChild'],
    current: 'childA',
    byId: {
      root: { sessionId: 'root', parentSessionId: 'childA', updatedAt: 10, running: false, blank: false, title: 'Root title', projectionValues },
      childA: { sessionId: 'childA', updatedAt: 30, running: true, blank: false, title: 'Child A' },
      childB: { sessionId: 'childB', updatedAt: 50, running: false, blank: false, title: 'Child B' },
      independent: { sessionId: 'independent', updatedAt: 20, running: false, blank: true, title: 'Independent' },
      independentChild: { sessionId: 'independentChild', updatedAt: 40, running: true, blank: false, title: 'Independent child' },
    },
  }
  const before = structuredClone(native)
  const actual = projectConversationList(native, catalog)
  assert.deepEqual(actual.ids, ['root', 'independent', 'independentChild'])
  assert.equal(actual.current, 'root')
  assert.equal(actual.byId.root.title, 'Root title')
  assert.equal(actual.byId.root.updatedAt, 50)
  assert.equal(actual.byId.root.running, true)
  assert.equal(actual.byId.root.parentSessionId, 'root')
  assert.notEqual(actual, native, 'list projection returns a new outer state object')
  assert.notEqual(actual.byId, native.byId, 'list projection returns a new projected row map')
  assert.notEqual(actual.byId.root, native.byId.root, 'changed aggregate fields create a new root row')
  assert.equal(actual.byId.root.projectionValues, projectionValues, 'unchanged nested projections remain shared')
  assert.equal(native.byId.root.parentSessionId, 'childA', 'native root row remains unchanged')
  assert.equal(native.byId.root.running, false, 'native root running state remains unchanged')
  assert.equal(actual.byId.childA, undefined)
  assert.deepEqual(native, before, 'list projection does not mutate native state')
}

{
  const native = {
    ids: ['root', 'childA', 'childB', 'orphanChild'], current: 'childB',
    byId: {
      root: { sessionId: 'root', updatedAt: 1, running: false, blank: false },
      childA: { sessionId: 'childA', updatedAt: 2, running: false, blank: false },
      childB: { sessionId: 'childB', updatedAt: 3, running: true, blank: false },
      orphanChild: { sessionId: 'orphanChild', updatedAt: 4, running: false, blank: false },
    },
  }
  const actual = projectConversationList(native, { schemaVersion:1, worldlines:{}, conversations:{} })
  assert.deepEqual(actual.ids, native.ids, 'missing root keeps native rows conservatively')
  assert.equal(actual.current, 'childB')
}

{
  const snapshot = {
    items: [
      { id:'workspace-root', sessionIds:['root'] },
      { id:'workspace-child', sessionIds:['childA','independent'] },
    ],
    archivedSessionIds: ['childB','independentChild'],
  }
  const actual = projectConversationWorkspaces(snapshot, catalog)
  assert.deepEqual(actual.items, [
    { id:'workspace-root', sessionIds:['root'] },
    { id:'workspace-child', sessionIds:['independent'] },
  ])
  assert.deepEqual(actual.archivedSessionIds, ['independentChild'],'archiving one legacy worldline must not archive its whole book')
  assert.deepEqual(snapshot.items[1].sessionIds, ['childA','independent'], 'workspace projection does not mutate native snapshot')
}
{
  const snapshot={items:[{id:'child-first',sessionIds:['childA']},{id:'root-second',sessionIds:['root']}],archivedSessionIds:[]}
  assert.deepEqual(projectConversationWorkspaces(snapshot,catalog).items,[{id:'child-first',sessionIds:[]},{id:'root-second',sessionIds:['root']}],'root keeps its own workspace regardless of child recency')
  const missing={ids:['childA'],byId:{childA:{sessionId:'childA',title:'child'}},current:'childA'}
  assert.deepEqual(projectConversationList(missing,catalog).ids,[],'known child stays hidden while its root is absent')
  assert.deepEqual(projectConversationList(missing,catalog).missingConversationIds,['root'])
  const search=projectConversationSearch({items:[{sessionId:'root',snippet:'old line'},{sessionId:'childB',snippet:'other line'},{sessionId:'childA',snippet:'current line'},{sessionId:'explicit',snippet:'separate'}],hasMore:false},catalog)
  assert.deepEqual(search.items,[{sessionId:'root',executionSessionId:'childA',snippet:'current line'},{sessionId:'explicit',snippet:'separate'}])
}

{
  const native = { ids:['childA','childFailed'], current:'childA', byId:{
    childA:{sessionId:'childA',updatedAt:5,running:true,blank:false},
    childFailed:{sessionId:'childFailed',updatedAt:6,running:false,blank:false},
  } }
  const actual = projectConversationList(native, { schemaVersion:1, worldlines:{
    childA:{conversationId:'root',status:'ready'}, childFailed:{conversationId:'root',status:'failed'},
  }, conversations:{root:{activeSessionId:'childA'}} })
  assert.deepEqual(actual.ids, [], 'known children stay hidden until their root is listed')
  assert.deepEqual(actual.missingConversationIds, ['root'])
  assert.equal(actual.current, 'root', 'current child always maps to its known root')
  assert.equal(actual.byId.root, undefined, 'missing root is not fabricated')
}

{
  const native = { ids:['root','childA','childFailed'], current:'childA', byId:{
    root:{sessionId:'root',updatedAt:1,running:false,blank:false,archived:true},
    childA:{sessionId:'childA',updatedAt:5,running:true,blank:false},
    childFailed:{sessionId:'childFailed',updatedAt:9,running:true,blank:false},
  } }
  const actual = projectConversationList(native, { schemaVersion:1, worldlines:{
    childA:{conversationId:'root',status:'ready'}, childFailed:{conversationId:'root',status:'failed'},
  }, conversations:{root:{activeSessionId:'childA'}} })
  assert.deepEqual(actual.ids, ['root'], 'archived roots remain one root row')
  assert.equal(actual.byId.root.archived, true)
  assert.equal(actual.byId.root.running, true, 'failed member remains aggregated without becoming a row')
  assert.deepEqual(actual.missingConversationIds, [])
}

{
  const executionCatalog = { schemaVersion:1, worldlines:{
    readyChild:{conversationId:'root',status:'ready'}, reservedChild:{conversationId:'root',status:'reserved'}, failedChild:{conversationId:'root',status:'failed'},
  }, conversations:{root:{activeSessionId:'readyChild'}} }
  assert.equal(resolveConversationExecution('root', executionCatalog, {activeSessionIdByConversation:{root:'readyChild'}}), 'readyChild')
  assert.equal(resolveConversationExecution('root', executionCatalog, {activeSessionIdByConversation:{root:'reservedChild'}}), 'readyChild')
  assert.equal(resolveConversationExecution('root', executionCatalog, {activeSessionIdByConversation:{root:'failedChild'}}), 'readyChild')
  assert.equal(resolveConversationExecution('root', {schemaVersion:1,worldlines:{},conversations:{}}, {}), 'root')
  const search = projectConversationSearch({items:[{sessionId:'readyChild',snippet:'hello'},{sessionId:'readyChild',snippet:'again'}],hasMore:false}, executionCatalog, {activeSessionIdByConversation:{root:'readyChild'}})
  assert.deepEqual(search.items, [{sessionId:'root',executionSessionId:'readyChild',snippet:'hello'}], 'search displays root and keeps execution session')
}

{
  const serverCurrent = { schemaVersion:1, worldlines:{
    oldTabLine:{conversationId:'root',status:'ready'}, serverLine:{conversationId:'root',status:'ready'},
  }, conversations:{root:{activeSessionId:'serverLine'}} }
  const staleTabChoice = {activeSessionIdByConversation:{root:'oldTabLine'}}
  assert.equal(resolveConversationExecution('root', serverCurrent, staleTabChoice), 'serverLine', 'a refresh must not let a tab-private old worldline override the durable server selection')
  const search = projectConversationSearch({items:[{sessionId:'oldTabLine',snippet:'old'},{sessionId:'serverLine',snippet:'current'}]}, serverCurrent, staleTabChoice)
  assert.deepEqual(search.items, [{sessionId:'root',executionSessionId:'serverLine',snippet:'current'}], 'search follows the durable selected worldline after refresh')
}

{
  // Native list updates carry every session's context projections, including
  // long timelines unrelated to the sidebar's title/running aggregation.
  const ids = Array.from({ length: 341 }, (_, i) => `session-${i}`)
  const byId = Object.fromEntries(ids.map((id, i) => [id, Object.freeze({
    id, title: id, updatedAt: i, running: false,
    projectionValues: Object.freeze({ contextTimeline: Object.freeze(Array.from({ length: 96 }, (_, seq) =>
      Object.freeze({ seq, text: `${id}:${seq}:` + 'x'.repeat(256) }))) }),
  })]))
  const native = Object.freeze({ ids: Object.freeze(ids), byId: Object.freeze(byId), current: ids[0],
    subagentsByParent: Object.freeze({}), jobsBySession: Object.freeze({}) })
  const emptyCatalog = { schemaVersion: 1, worldlines: {}, conversations: {} }
  const originalClone = globalThis.structuredClone
  let copies = 0, actual
  const started = performance.now()
  globalThis.structuredClone = (...args) => { copies++; return originalClone(...args) }
  try {
    for (let tick = 0; tick < 24; tick++) {
      const nextRow = Object.freeze({ ...byId[ids[0]], updatedAt: 1000 + tick, running: true })
      actual = projectConversationList({ ...native, byId: { ...byId, [ids[0]]: nextRow } }, emptyCatalog)
      assert.equal(actual.byId[ids[0]].running, true)
      assert.equal(actual.byId[ids[0]].updatedAt, 1000 + tick)
    }
  } finally { globalThis.structuredClone = originalClone }
  console.log(`conversation-list-stream: ${Math.round(performance.now() - started)}ms, deepCopies=${copies}`)
  assert.equal(copies, 0, 'streaming list updates must not deep-copy all resident session timelines')
  assert.equal(actual.byId[ids[1]].projectionValues, byId[ids[1]].projectionValues,
    'unchanged native projection values remain shared read-only snapshots')
  assert.equal(actual.jobsBySession, native.jobsBySession)
  assert.equal(native.byId[ids[0]].running, false, 'projection never writes through to native state')
}

{
  const ids = Array.from({length:150000}, (_, i) => `worldline-${i}`)
  const root = ids[0]
  const byId = Object.fromEntries(ids.map((id, i) => [id, {updatedAt:i,running:i===ids.length-1}]))
  const catalog = {schemaVersion:1,worldlines:Object.fromEntries(ids.map(id => [id,{conversationId:root,status:'ready'}])),conversations:{}}
  const actual = projectConversationList({ids,byId,current:root},catalog)
  assert.deepEqual(actual.ids,[root])
  assert.equal(actual.byId[root].updatedAt,ids.length-1,'large groups do not overflow function argument limits')
  assert.equal(actual.byId[root].running,true)
}
{
  // A workspace carries every session id in it, so cloning the snapshot on each
  // native update is the same cost the list projection already dropped.
  const catalogW = { schemaVersion:1, worldlines:{ childX:{conversationId:'rootW',status:'ready'} }, conversations:{} }
  const snapshot = Object.freeze({
    items: Object.freeze([
      Object.freeze({ id:'ws-untouched', sessionIds: Object.freeze(['plain']) }),
      Object.freeze({ id:'ws-folded', sessionIds: Object.freeze(['rootW','childX']) }),
    ]),
    archivedSessionIds: Object.freeze(['childX','plainArchived']),
  })
  const originalClone = globalThis.structuredClone
  let copies = 0, first, second
  globalThis.structuredClone = (...args) => { copies++; return originalClone(...args) }
  try {
    first = projectConversationWorkspaces(snapshot, catalogW)
    second = projectConversationWorkspaces(snapshot, catalogW)
  } finally { globalThis.structuredClone = originalClone }
  assert.equal(copies, 0, 'workspace projection must not deep-copy the native snapshot')
  assert.equal(first.items[0], snapshot.items[0], 'a workspace whose members are unchanged keeps its native item')
  assert.equal(second.items[0], snapshot.items[0])
  assert.deepEqual(first.items[1].sessionIds, ['rootW'], 'child worldlines are folded into their root')
  assert.deepEqual(snapshot.items[1].sessionIds, ['rootW','childX'], 'workspace projection does not mutate native items')
  assert.deepEqual(first.archivedSessionIds, ['plainArchived'], 'archiving a child must not archive its whole book')
}
console.log('conversation-projection=ok')
