import assert from 'node:assert/strict'
import { createConversationCatalog } from '../src/core/tavern-conversations.js'
let disk=null,fail=false
const store=()=>createConversationCatalog({read:()=>disk,write:async value=>{if(fail)throw new Error('disk failure');disk=structuredClone(value)}})
let catalog=store()
const reservation={sourceSessionId:'root',childSessionId:'line-a',operationId:'op-a',kind:'regenerate',sourceHash:'a'.repeat(64)}
await catalog.reserve(reservation)
assert.equal(catalog.snapshot().worldlines['line-a'].conversationId,'root','reservation is durable before child publication')
assert.equal(catalog.snapshot().conversations.root.activeSessionId,'root','reservation never selects an unready child')
await assert.rejects(catalog.activate('line-a'),/尚未就绪/)
await catalog.markReady('line-a')
assert.equal(catalog.snapshot().conversations.root.activeSessionId,'root','registration never changes selection')
await catalog.activate('line-a')
assert.equal(catalog.snapshot().conversations.root.activeSessionId,'line-a')
await catalog.reserve({...reservation,sourceSessionId:'line-a',childSessionId:'line-b',operationId:'op-b',kind:'player-edit'})
await catalog.markReady('line-b')
await catalog.activate('line-b')
assert.equal(catalog.rootOf('line-b'),'root')
assert.equal(catalog.rootOf('explicit-clone'),'explicit-clone','native parentSession alone is never a worldline')
catalog=store()
assert.equal(catalog.snapshot().conversations.root.activeSessionId,'line-b','restart retains the selected worldline')
await catalog.activate('root')
assert.equal(catalog.snapshot().conversations.root.activeSessionId,'root')
await assert.rejects(catalog.reserve({...reservation,sourceSessionId:'unrelated'}),/归属|绑定/)
fail=true
await assert.rejects(catalog.activate('line-a'),/disk failure/)
assert.equal(catalog.snapshot().conversations.root.activeSessionId,'root','a failed commit is never published')
fail=false
const legacy=[
 {schemaVersion:1,operationId:'old2',kind:'regenerate',consumed:true,childSessionId:'old-b',groupId:'g',anchor:{sourceSessionId:'old-a'}},
 {schemaVersion:1,operationId:'old1',kind:'player-edit',state:'registered',childSessionId:'old-a',groupId:'g',anchor:{sourceSessionId:'old-root'}},
 {schemaVersion:1,operationId:'bad',kind:'regenerate',state:'failed',consumed:true,childSessionId:'bad-child',groupId:'g',anchor:{sourceSessionId:'root'}},
 {schemaVersion:1,operationId:'incomplete',kind:'regenerate',childSessionId:'incomplete-child',groupId:'g',anchor:{sourceSessionId:'root'}},
 {schemaVersion:1,operationId:'unregistered',kind:'regenerate',childSessionId:'unowned',anchor:{sourceSessionId:'root'}},
]
await catalog.migrate(legacy)
assert.equal(catalog.rootOf('old-b'),'old-root','legacy registered operation evidence is resolved topologically')
assert.equal(catalog.rootOf('unowned'),'unowned','unregistered legacy guesses remain independent')
assert.equal(catalog.rootOf('bad-child'),'bad-child')
assert.equal(catalog.rootOf('incomplete-child'),'incomplete-child')
const revision=catalog.snapshot().revision
await catalog.migrate(legacy)
assert.equal(catalog.snapshot().revision,revision,'migration is idempotent')
assert.ok(!JSON.stringify(catalog.snapshot()).includes('promptText'),'catalog never stores story content')
await catalog.activate('line-b')
await catalog.fail('line-a')
assert.equal(catalog.snapshot().conversations.root.activeSessionId,'line-b','late abort cannot overwrite another selection')
await catalog.fail('line-b')
assert.equal(catalog.snapshot().conversations.root.activeSessionId,'root','failed parent is skipped on rollback')
assert.equal(catalog.rootOf('line-b'),'root','failed ownership remains durable')
await assert.rejects(catalog.activate('line-b'),/尚未就绪/)
await assert.rejects(catalog.markReady('line-b'),/失效/)
await catalog.reserve({...reservation,childSessionId:'restart-child',operationId:'restart-op'})
await catalog.markReady('restart-child');await catalog.activate('restart-child')
catalog=store()
await catalog.migrate([{operationId:'foreign',childSessionId:'restart-child',state:'failed'}])
assert.equal(catalog.snapshot().worldlines['restart-child'].status,'ready','foreign failure cannot poison ownership')
await catalog.migrate([{operationId:'restart-op',reservedChildSessionId:'restart-child',state:'failed'}])
assert.equal(catalog.snapshot().worldlines['restart-child'].status,'failed','startup reconciles a failure committed only in operation table')
assert.equal(catalog.snapshot().conversations.root.activeSessionId,'root')
console.log('tavern conversations: PASS')
