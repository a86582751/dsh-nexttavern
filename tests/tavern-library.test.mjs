import assert from 'node:assert/strict'
import { rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createTestDirectory } from '../tools/test-temp.mjs'
import { join } from 'node:path'
import { createTavernLibrary } from '../src/core/tavern-library.js'
import { createResourceBridge } from '../src/core/roleplay-resource-bridge.js'
import { createHash } from 'node:crypto'

function makeTable({ failPuts = 0 } = {}) {
  const values = new Map(); let remaining = failPuts
  return {
    values,
    get(key) { return values.get(key) }, entries() { return values.entries() },
    async put(key, value) { if (remaining-- > 0) throw new Error('simulated late durable write failure'); values.set(key, structuredClone(value)) },
  }
}
const workspace = createTestDirectory('tavern-library-')
try {
  const table = makeTable()
  const library = createTavernLibrary({ workspace, table })
  const source = { sessionId: 'session-a', importId: 'import-a' }
  const first = await library.archive({ name: '港口设定.md', type: 'text/markdown; charset=utf-8', bytes: Buffer.from('# 港口\n潮水'), source })
  assert.equal(first.schemaVersion, 1); assert.match(first.id, /^[a-f0-9]{64}$/); assert.match(first.fullSha256, /^[a-f0-9]{64}$/)
  assert.ok(Number.isFinite(Date.parse(library.metadata(first.id).modifiedAt)),'resource list exposes actual file modification time')
  const second = await library.archive({ name: '另一名字.md', type: 'text/markdown', bytes: Buffer.from('# 港口\n潮水'), source: { sessionId: 'session-b', importId: 'import-b' } })
  assert.equal(second.id, first.id, 'same bytes must deduplicate by complete sha256'); assert.equal(second.deduplicated, true)
  assert.equal(second.name, first.name, 'dedup retains first readable filename')
  assert.equal(second.source.sessionId, 'session-a', 'legacy first provenance stays stable')
  assert.deepEqual(second.sources.map(item => item.sessionId), ['session-a', 'session-b'], 'dedup merges independent archival evidence')
  const peer = createTavernLibrary({ workspace, table })
  const [parallelA, parallelB] = await Promise.all([
    library.archive({ name: 'ignored-a.md', type: 'text/markdown', bytes: Buffer.from('# 港口\n潮水'), source: { sessionId: 'session-c' } }),
    peer.archive({ name: 'ignored-b.md', type: 'text/markdown', bytes: Buffer.from('# 港口\n潮水'), source: { sessionId: 'session-d' } }),
  ])
  assert.equal(parallelA.id, first.id); assert.equal(parallelB.id, first.id)
  assert.deepEqual(library.metadata(first.id).sources.map(item => item.sessionId), ['session-a', 'session-b', 'session-c', 'session-d'], 'cross-instance same-workspace archive serializes evidence merge')
  const otherWorkspace = createTestDirectory('tavern-library-other-')
  try {
    const other = createTavernLibrary({ workspace: otherWorkspace, table })
    const otherRecord = await other.archive({ name: '港口设定.md', type: 'text/markdown', bytes: Buffer.from('# 港口\n潮水'), source })
    assert.notEqual(otherRecord.id, first.id, 'shared DSH table must scope records by actual workspace')
    assert.equal(other.list().length, 1); assert.equal(library.list().length, 1)
  } finally { rmSync(otherWorkspace, { recursive: true, force: true }) }
  const collision = await library.archive({ name: '港口设定.md', type: 'text/plain', bytes: Buffer.from('different bytes'), source })
  assert.notEqual(collision.id, first.id, 'same name and different hash must be preserved')
  assert.equal(library.list().length, 2)
  const meta = library.metadata(first.id); assert.equal(meta.sha256, first.fullSha256); assert.equal(meta.createdAt, first.createdAt); assert.equal(meta.path, join(workspace, 'tavern-library', 'objects', first.objectName))
  assert.equal(library.read(first.id).text, '# 港口\n潮水')
  const download = library.openDownload(first.id)
  assert.equal(download.headers.get('cache-control'), 'private, no-store'); assert.equal(download.headers.get('x-content-type-options'), 'nosniff')
  assert.match(download.headers.get('content-disposition'), /filename\*=UTF-8''/)
  assert.equal(await download.text(), '# 港口\n潮水')

  const binary = await library.archive({ name: '头像.png', type: 'image/png', bytes: Buffer.from([1, 2, 3]), source })
  assert.throws(() => library.read(binary.id), /安全文本类型/)
  const object = join(workspace, 'tavern-library', 'objects', first.objectName)
  writeFileSync(object, 'tampered')
  assert.throws(() => library.read(first.id), /损坏|不安全/)
  assert.throws(() => library.openDownload(first.id), /损坏|不安全/)
  assert.equal(library.list().length,2,'one damaged resource cannot hide other verified resources')
  assert.ok(library.pending().some(p=>p.resourceId===first.id&&p.state==='pending'))

  const many = makeTable()
  for (let index = 0; index < 2000; index++) many.values.set(`noise-${index}`, { schemaVersion: 1, id: `noise-${index}` })
  const manyLibrary = createTavernLibrary({ workspace: createTestDirectory('tavern-library-many-'), table: many })
  assert.equal(manyLibrary.list().length, 0, 'unrelated table records are ignored without materializing an intermediate array')

  assert.rejects(library.archive({ name: '../escape', type: 'text/plain', bytes: Buffer.from('x'), source }), /名称/)
  assert.rejects(library.archive({ name: 'x', type: 'text/plain', bytes: Buffer.alloc(20_000_001), source }), /大小/)

  const symlinkWorkspace = createTestDirectory('tavern-library-link-')
  const outside = createTestDirectory('tavern-library-outside-')
  try {
    const linked = createTavernLibrary({ workspace: symlinkWorkspace, table: makeTable() })
    const objects = join(symlinkWorkspace, 'tavern-library', 'objects')
    rmSync(objects, { recursive: true, force: true })
    try {
      symlinkSync(outside, objects, 'junction')
      await assert.rejects(linked.archive({ name: 'symlink.txt', type: 'text/plain', bytes: Buffer.from('new'), source }), /符号链接|目录链接|不安全/)
    } catch (error) {
      if (!/operation not permitted|EPERM|privilege/i.test(String(error))) throw error
    }
  } finally { rmSync(symlinkWorkspace, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }) }

  const lateTable = makeTable({ failPuts: 1 })
  const late = createTavernLibrary({ workspace: createTestDirectory('tavern-library-late-'), table: lateTable })
  await assert.rejects(late.archive({ name: 'retry.txt', type: 'text/plain', bytes: Buffer.from('durable retry'), source }), /late durable/)
  const recovered = await late.archive({ name: 'retry.txt', type: 'text/plain', bytes: Buffer.from('durable retry'), source })
  assert.equal(recovered.deduplicated, false, 'orphaned verified object must be recorded on retry')
  assert.equal(late.read(recovered.id).text, 'durable retry')

  const migrationTable = makeTable(), migrationWorkspace = createTestDirectory('tavern-library-migrate-')
  const migration = createTavernLibrary({ workspace: migrationWorkspace, table: migrationTable })
  const missing = await migration.migrate({ id: 'legacy-missing', name: 'lost.txt', type: 'text/plain', source: { sessionId: 's' }, path: join(workspace, 'missing.txt') })
  assert.equal(missing.ok, false); assert.equal(migration.pending()[0].schemaVersion, 1); assert.equal(migration.pending()[0].state, 'pending')
  const completed = await migration.migrate({ id: 'legacy-missing', name: 'lost.txt', type: 'text/plain', source: { sessionId: 's' }, bytes: Buffer.from('recovered') })
  assert.equal(completed.ok, true); assert.equal(migration.pending().length,0,'completed migrations disappear from pending resources')

  const saved = [...migrationTable.values.entries()].find(([, value]) => value.id === completed.resource.id && value.objectName)
  saved[1].extension = { author: 'legacy', flags: [1, 2] }
  delete saved[1].sources
  const reopened = createTavernLibrary({ workspace: migrationWorkspace, table: migrationTable })
  const snapshot = structuredClone([...migrationTable.values.entries()])
  const put = migrationTable.put
  migrationTable.put = async () => { throw Error('read-only restoration must not write') }
  assert.equal(reopened.read(completed.resource.id).text, 'recovered')
  assert.deepEqual(reopened.metadata(completed.resource.id).sources, [saved[1].source])
  assert.equal(await reopened.openDownload(completed.resource.id).text(), 'recovered')
  assert.deepEqual([...migrationTable.values.entries()], snapshot)
  migrationTable.put = put

  for (const [label, bytes, expected] of [['string', 'string body', 'string body'], ['array', [65, 66], 'AB'], ['arraybuffer', new Uint8Array([67, 68]).buffer, 'CD']]) {
    const value = await migration.migrate({ id: label, name: `${label}.txt`, type: 'text/plain', bytes, source: { sessionId: 's' } })
    assert.equal(value.ok, true); assert.equal(migration.read(value.resource.id).text, expected)
  }
  assert.equal((await migration.migrate({ id: 'invalid-bytes', name: 'bad.txt', type: 'text/plain', bytes: 5, source: { sessionId: 's' } })).ok, false)
  assert.equal(migration.pending().find(record => record.id === 'invalid-bytes').schemaVersion, 1)
  const invalidUtf8 = await migration.archive({ name: 'invalid.txt', type: 'text/plain', bytes: new Uint8Array([255]), source: { sessionId: 's' } })
  assert.throws(() => migration.read(invalidUtf8.id), /UTF-8/)
} finally { rmSync(workspace, { recursive: true, force: true }) }
for(const hasValues of [false,true]) {
 const root=createTestDirectory('resource-bridge-'),other=createTestDirectory('resource-bridge-other-')
 try {
  const table=makeTable(),store=table.values
  if(hasValues)table.values=()=>store.values()
  else delete table.values
  const session={id:'owner',header:{cwd:root}},bridge=createResourceBridge({T:{branch:table}})
  const bytes='# Complete author source',hash=createHash('sha256').update(bytes).digest('hex')
  const record={importId:'import-one',sessionId:'original-owner',status:'active',workspaceRoot:root,sourceFile:'source.MD',rawSource:bytes,rawSha256:hash,assignments:[{target:'card',name:'author-name'}],resourceTitle:'chosen:title'}
  store.set('import-one',record)
  store.set('other-import',{...record,importId:'other',workspaceRoot:other,rawSource:'other-workspace'})
  store.set('broken-import',{...record,importId:'broken',rawSha256:'incorrect'})
  const first=await bridge.archiveImported(session,record)
  assert.equal(first.name,'chosen-title.md')
  assert.equal(first.type,'text/markdown')
  assert.equal(first.source.sessionId,'original-owner')
  assert.equal(bridge.libraryFor({...session,id:'same-workspace'}),bridge.libraryFor(session))
  assert.notEqual(bridge.libraryFor({id:'elsewhere',header:{cwd:other}}),bridge.libraryFor(session))
  await assert.rejects(bridge.archiveImported(session,{...record,rawSha256:'incorrect'}),/哈希不匹配/)
  const exportFile=join(root,'export.md');writeFileSync(exportFile,'export text')
  store.set('export',{exportId:'export-one',status:'completed',file:exportFile,title:'export',branchId:'export-owner',resultHash:createHash('sha256').update('export text').digest('hex')})
  store.set('outside',{exportId:'outside',status:'completed',file:join(other,'outside.md')})
  const library=await bridge.migrateResources(session)
  assert.equal(library.list().length,2,'mixed table scan migrates only valid local import/export rows')
  assert.equal(library.read(first.id).text,bytes)
  await bridge.migrateResources(session)
  assert.equal(library.list().length,2,'repeat resource scans are idempotent')
  const broken={...record,importId:'retry',rawSource:'retry body',rawSha256:createHash('sha256').update('retry body').digest('hex')}
  const put=table.put;let fail=true
  table.put=async(key,value)=>{if(fail&&key.startsWith('tavern_library_resource__')){fail=false;throw Error('fixture failed write')}return put(key,value)}
  await assert.rejects(bridge.archiveImported(session,broken),/入库待重试/)
  assert.ok(library.pending().some(row=>row.source.importId==='retry'))
  await bridge.archiveImported(session,broken)
  assert.ok(!library.pending().some(row=>row.source.importId==='retry'))
 } finally {rmSync(root,{recursive:true,force:true});rmSync(other,{recursive:true,force:true})}
}
console.log('tavern-library=ok (dedup/collision/tamper/path/symlink/late-write/migration/download/resource bridge)')






