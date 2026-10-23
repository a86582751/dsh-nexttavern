import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {createRequire} from 'node:module'
import {fileURLToPath, pathToFileURL} from 'node:url'
import { exportSnapshot, renderOrganizedExport, registerCardExport } from '../lib/core/card-export.js'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createTestDirectory, cleanupTestDirectory } from '../lib/operations/test-temp.mjs'
import { stableJson as exportJson } from '../lib/core/card-export-projection.js'
import { stableJson as recordJson, recordSha256 } from '../lib/core/roleplay-data.js'

const hydrate = (table, key) => {
  const control = table.get(key)
  return control.schemaVersion === 2 ? {...control, ...table.get(control.snapshotKey), schemaVersion: 1} : control
}

// Lock the two historical formats separately; a shared serializer would alter hashes.
const hashSample = {Z: 1, a: 2, omitted: undefined, nested: {Z: 3, a: 4}, list: [undefined, null, {Z: 5, a: 6}]}
const recordBytes = '{"Z":1,"a":2,"list":[null,null,{"Z":5,"a":6}],"nested":{"Z":3,"a":4}}'
const exportBytes = '{"a":2,"list":[null,null,{"a":6,"Z":5}],"nested":{"a":4,"Z":3},"Z":1}'
assert.equal(recordJson(hashSample), recordBytes)
assert.equal(exportJson(hashSample), exportBytes)
assert.equal(recordJson(undefined), 'null')
assert.equal(exportJson(undefined), undefined)
assert.equal(recordSha256(hashSample), createHash('sha256').update(recordBytes).digest('hex'))
assert.equal(recordSha256(undefined), 'missing')

const material = [
  { label: '人物设定', source: 'card.data.description', text: `人物的长段设定：${'守望灯塔，记录每一次潮汐。'.repeat(180)}` },
  { label: '世界书条目', source: 'card.data.character_book.entries[0]', text: `世界书的长段细节：${'港口的钟声与旧地图必须原样保留。'.repeat(180)}` },
  { label: '用户编辑', source: 'selected-branch.edit[3]', text: `当前分支编辑内容：${'这是用户刚刚修订的设定，不能被旧原件覆盖。'.repeat(180) }` },
]
const snapshot = exportSnapshot('branch-current', material)
assert.equal(snapshot.schemaVersion, 1)
assert.equal(snapshot.units.length, material.length)
assert.equal(snapshot.units[0].id, 'source-1')

const reordered = renderOrganizedExport(snapshot, '完整角色设定', [
  { heading: '当前编辑', source_ids: ['source-3'] },
  { heading: '世界与人物', source_ids: ['source-2', 'source-1'] },
])
assert.ok(reordered.indexOf('## 当前编辑') < reordered.indexOf('## 世界与人物'))
for (const item of material) assert.ok(reordered.includes(item.text), `missing exact source text: ${item.label}`)
assert.match(reordered, /sourceHash=[a-f0-9]{64} sources=3/)

assert.throws(() => renderOrganizedExport(snapshot, '漏项', [
  { heading: '只导出一项', source_ids: ['source-1'] },
]), /覆盖全部当前设定|漏项/)
assert.throws(() => renderOrganizedExport(snapshot, '重复来源', [
  { heading: '一', source_ids: ['source-1'] },
  { heading: '二', source_ids: ['source-1', 'source-2', 'source-3'] },
]), /重复|不存在/)
assert.throws(() => renderOrganizedExport(snapshot, '未知来源', [
  { heading: '未知', source_ids: ['source-1', 'source-404', 'source-2', 'source-3'] },
]), /重复|不存在/)

const tampered = structuredClone(snapshot)
tampered.units[1].sha256 = '0'.repeat(64)
assert.throws(() => renderOrganizedExport(tampered, '篡改', [
  { heading: '全部', source_ids: ['source-1', 'source-2', 'source-3'] },
]), /哈希不一致/)

const safeHeadings = renderOrganizedExport(snapshot, '标题\n## 注入标题', [
  { heading: '章节\n### 注入章节', source_ids: ['source-1', 'source-2', 'source-3'] },
])
assert.equal((safeHeadings.match(/^#/gm) ?? []).length, 2, 'title and section must each produce one heading')
assert.equal(/^## 注入标题/m.test(safeHeadings), false)
assert.equal(/^### 注入章节/m.test(safeHeadings), false)

const editedMaterial = material.map(item => ({ ...item }))
editedMaterial[2].text += ' 用户新增的一句编辑。'
const editedSnapshot = exportSnapshot('branch-current', editedMaterial)
assert.notEqual(editedSnapshot.sourceHash, snapshot.sourceHash, 'different current edits must produce different snapshot hashes')

assert.throws(() => exportSnapshot('branch-empty', []), /没有可导出|条目超限/)
const mixed=exportSnapshot('branch-current',[{label:'用户编辑的混合设定',source:'rules.core',text:'世界有三轮月。\n镜头语言：从雨水推进到人物手部。\n回复使用流畅长段。'}])
const sections=[
  {heading:'核心设定',source_parts:[{source_id:'source-1',start_line:1,end_line:1}]},
  {heading:'叙事规则',source_parts:[{source_id:'source-1',start_line:2,end_line:2}]},
  {heading:'回复规则',source_parts:[{source_id:'source-1',start_line:3,end_line:3}]},
]
const organized=renderOrganizedExport(mixed,'按创作用途整理',sections)
assert.match(organized,/## 叙事规则\n\n镜头语言：从雨水推进到人物手部。/)
assert.throws(()=>renderOrganizedExport(mixed,'漏行',sections.slice(0,2)),/覆盖|漏/)
assert.throws(()=>renderOrganizedExport(mixed,'重叠',[...sections,{heading:'重复',source_ids:['source-1']}]),/重复|重叠/)
assert.throws(()=>renderOrganizedExport(mixed,'越界',[{heading:'越界',source_parts:[{source_id:'source-1',start_line:0,end_line:4}]}]),/跨度|行号/)
console.log('card-export=ok (LLM reorder, lossless source coverage, tamper/heading/hash/empty guards)')

const workspace = createTestDirectory('card-export-workflow-')
try {
  const tools = new Map(), effects = [], records = new Map([['unrelated', null]])
  const session = { id: 'branch-export', header: { cwd: workspace } }
  const writes = []; let failCompleted = false, failMain = false
  registerCardExport({
    tools: { register(tool) { tools.set(tool.name, tool); return () => tools.delete(tool.name) } },
    effect(work) { effects.push(work()) },
  }, {
    simpleTool: (name, description, parameters, execute) => ({ name, description, parameters, execute }),
    sessionOf: exec => exec?.agent?.session ?? session,
    table: { get: key => records.get(key), entries: () => records.entries(), async put(key, value) {
      if (failMain && value.schemaVersion === 2) { failMain = false; throw Error('injected control failure') }
      if (failCompleted && value.status === 'completed') { failCompleted = false; throw Error('injected durable failure') }
      writes.push({key, bytes: Buffer.byteLength(JSON.stringify(value))}); records.set(key, structuredClone(value))
    } },
    collect: () => material,
    lock: async (id, scope, work) => { assert.equal(scope, 'export'); return await work() },
    workflowOf: () => 'workflow-export',
    onCompleted: async (_session, value) => { assert.equal(records.get(`${session.id}__export-${value.exportId}`).status, 'completed'); return { id: 'resource-1', name: 'card.md' } },
  })
  const finalize = tools.get('rp_card_export_finalize')
  // Registered schema and model-facing description at the 9e5de799 baseline.
  assert.equal(createHash('sha256').update(JSON.stringify([...tools.values()])).digest('hex'), 'd394096e16d6645950abc2ec2a47c807a318de883c51f3d25029bafe969d7c1a')
  assert.deepEqual(finalize.parameters.properties.sections.items.required, ['heading'])
  assert.deepEqual(finalize.parameters.properties.sections.items.properties.source_parts.items.required, ['source_id', 'start_line', 'end_line'])
  assert(effects.every(dispose => typeof dispose === 'function'), 'host owns registration disposers')
  const run = (name, args, exec) => tools.get(`rp_card_export_${name}`).execute(args, exec)
  const begun = await run('begin', {})
  assert.equal(begun.ok, true, 'unrelated null records must not prevent begin')
  const id = begun.exportId, key = `${session.id}__export-${id}`
  const sourceKey = records.get(key).snapshotKey
  assert.equal(records.get(key).schemaVersion, 2)
  assert.equal('text' in records.get(key), false, 'cursor writes carry no full snapshot')
  for (const name of ['workflowId', 'exportId', 'status']) assert.equal(name in records.get(sourceKey), false, 'static rows cannot be mistaken for workflow records')
  assert.equal((await run('begin', {})).exportId, id, 'resume existing workflow')
  const legacy = structuredClone(hydrate(records, key)); delete legacy.encoding; delete legacy.snapshotKey
  records.set(key, legacy)
  failMain = true
  assert.equal((await run('chunk', {export_id: id, cursor: 0})).ok, false)
  assert.deepEqual(records.get(key), legacy, 'failed lazy migration keeps the original v1 cursor recoverable')
  assert.equal((await run('chunk', { export_id: id, cursor: 1 })).ok, false, 'cannot skip initial page')
  const submit = { export_id: id, expected_sha256: begun.sourceHash, title: 'Export', sections: [{ heading: 'All', source_ids: begun.sources.map(source => source.id) }] }
  assert.equal((await run('finalize', submit)).ok, false, 'must review full source')
  let cursor = 0
  do { const page = await run('chunk', { export_id: id, cursor }); assert.equal(page.ok, true); cursor = page.nextCursor } while (cursor !== null)
  const sourceWrites = writes.filter(write => write.key === sourceKey).length
  assert.equal(sourceWrites, 3, 'begin and the failed/successful legacy migration write the body once each')
  assert.ok(writes.filter(write => write.key === key).every(write => write.bytes < 1024), 'all durable review cursors contain only small metadata')
  const last = records.get(key).lastCursor, beforeReplay = writes.length
  const replay = await run('chunk', {export_id: id, cursor: last})
  assert.equal(replay.ok, true); assert.equal(replay.nextCursor, null); assert.equal(replay.reviewComplete, true)
  assert.equal(writes.length, beforeReplay, 'the acknowledged last page replays without another write')
  const beforeInvalid = structuredClone(records.get(key))
  const beforeSource = structuredClone(records.get(sourceKey))
  for (const [mutate, message] of [
    [record => {record.sourceHash = '0'.repeat(64)}, /导出快照损坏/],
    [record => {record.material[0].text += 'changed'}, /导出快照损坏/],
    [record => {record.text += 'changed'}, /导出正文或来源映射损坏/],
    [record => {record.units[0].sha256 = '0'.repeat(64)}, /导出正文或来源映射损坏/],
  ]) {
    const damaged = structuredClone(beforeSource); mutate(damaged); records.set(sourceKey, damaged)
    const rejected = await run('chunk', {export_id: id, cursor: 0})
    assert.equal(rejected.ok, false); assert.match(rejected.error, message)
    assert.deepEqual(records.get(sourceKey), damaged, 'cold snapshot rejection preserves the damaged durable record')
    records.set(sourceKey, structuredClone(beforeSource))
  }
  assert.equal((await run('chunk', { export_id: id, source_id: 1, cursor: 0 })).ok, false, 'invalid source_id must not silently use cursor')
  assert.deepEqual(records.get(key), beforeInvalid)
  assert.equal((await run('chunk', { export_id: id, cursor: 0 }, { agent: { session: { ...session, id: 'other' } } })).ok, false)
  failCompleted = true
  assert.equal((await run('finalize', submit)).ok, false)
  assert.equal(records.get(key).status, 'committing', 'failed durable completion remains recoverable')
  const legacyPrepared = structuredClone(hydrate(records, key)); delete legacyPrepared.encoding; delete legacyPrepared.snapshotKey
  records.set(key, legacyPrepared)
  const done = await run('finalize', submit)
  assert.equal(done.ok, true); assert.equal(done.resourceId, 'resource-1')
  assert.equal(records.get(key).schemaVersion, 2, 'a v1 prepared result resumes and migrates without losing its result hash')
  const bytes = readFileSync(done.file, 'utf8')
  assert.equal(bytes, renderOrganizedExport(hydrate(records, key), submit.title, submit.sections))
  assert.equal((await run('finalize', submit)).sha256, done.sha256, 'same result resumes idempotently')
  assert.equal((await run('finalize', { ...submit, title: 'Different' })).ok, false)
  writeFileSync(done.file, 'foreign content')
  assert.equal((await run('finalize', submit)).ok, false, 'cannot overwrite different content')
  assert.equal(readFileSync(done.file, 'utf8'), 'foreign content')
  assert.equal(readdirSync(`${workspace}/.dsh-card-exports`).filter(name => name.endsWith('.tmp')).length, 0)
  for (const dispose of effects) dispose()
  assert.equal(tools.size, 0)
  console.log('card-export-workflow=ok (schema, disposal, paging, branch, durable retry and overwrite refusal)')
} finally { cleanupTestDirectory(workspace) }

// Use the installed Domain implementation and the maintained JSON backend, not
// a mutable Map substitute: these records are immutable DATA by contract and are
// replaced through real durable put calls. No Harness, Agent or model is started.
{
  const require = createRequire(new URL('../build-tools/package.json', import.meta.url))
  const {DomainFacility} = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-storage-domain')).href)
  const {z} = await import(pathToFileURL(require.resolve('zod')).href)
  const {build} = await import('../build-tools/node_modules/esbuild/lib/main.js')
  const backendBundle = await build({
    entryPoints: [fileURLToPath(new URL('../development/storage-json/src/index.ts', import.meta.url))],
    bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022',
    plugins: [{name: 'locked-domain-peers', setup(builder) {
      builder.onResolve({filter: /^@deepseek-ai\//}, args => ({
        path: pathToFileURL(require.resolve(args.path)).href, external: true,
      }))
    }}],
  })
  const {JsonStorageBackend} = await import('data:text/javascript;base64,' + Buffer.from(backendBundle.outputFiles[0].text).toString('base64'))
  const home = createTestDirectory('card-export-domain-'), backend = new JsonStorageBackend(`${home}/storage`)
  let facility, domain, table, tools, granted = true
  const context = {storage: {backend: {get: () => backend}}, logger: {warn() {}, error() {}},
    emit(name, change) {
      assert.equal(name, 'domain/changed')
      if (change.operation === 'put') assert.equal(facility.get(change.domain).table(change.table).get(change.key), change.value)
    }}
  facility = new DomainFacility(context, {backend: 'json'})
  const spec = {name: 'roleplay', version: 1, layout: 'per-record', tables: {branch: {valueSchema: z.unknown()}}}
  const session = {id: 'domain-export', header: {cwd: home}}
  let current = [{label: '真实表分页夹具', source: {kind: 'synthetic'}, text: '每页完整保留当前原文。\n'.repeat(2000)}]
  const mount = () => {
    tools = new Map()
    registerCardExport({effect: work => work(), tools: {register: tool => {tools.set(tool.name, tool); return () => tools.delete(tool.name)}}}, {
      simpleTool: (name, description, parameters, execute) => ({name, description, parameters, execute}),
      sessionOf: () => session, table, collect: () => current, lock: async (_id, _scope, work) => await work(),
      assertWorkflow: () => {if (!granted) throw Error('角色卡任务授权已取消')},
    })
  }
  const run = (name, args) => tools.get(`rp_card_export_${name}`).execute(args, {})
  const unfence = text => text.split('\n').slice(2, -1).join('\n')
  try {
    domain = await facility.open(spec); table = domain.table('branch'); mount()
    const begun = await run('begin', {}), id = begun.exportId, key = `${session.id}__export-${id}`
    assert.equal(begun.ok, true)
    const warm = table.get(key), sourceKey = warm.snapshotKey, warmSource = table.get(sourceKey)
    assert.equal(warm, table.get(key)); assert.equal(warm, [...table.entries()].find(([name]) => name === key)[1])
    const first = await run('chunk', {export_id: id, cursor: 0})
    assert.equal(first.ok, true); assert.equal(first.nextCursor, 16000)
    await domain.close()
    domain = await facility.open(spec); table = domain.table('branch'); mount()
    assert.notEqual(table.get(key), warm, 'reopened JSON records have an unknown object identity')
    let cursor = first.nextCursor, body = unfence(first.text)
    do {
      const page = await run('chunk', {export_id: id, cursor}); assert.equal(page.ok, true)
      body += unfence(page.text); cursor = page.nextCursor
    } while (cursor !== null)
    assert.equal(body, warmSource.text, 'a new exporter resumes persisted cursor progress without changing source bytes')
    granted = false
    assert.equal((await run('chunk', {export_id: id, cursor: 0})).ok, false, 'known static material never bypasses the live workflow gate')
    granted = true
    const valid = structuredClone(table.get(sourceKey))
    for (const mutate of [record => {record.material[0].text += 'changed'}, record => {record.text += 'changed'},
      record => {record.units[0].sha256 = '0'.repeat(64)}]) {
      const damaged = structuredClone(valid); mutate(damaged); await table.put(sourceKey, damaged)
      assert.equal((await run('chunk', {export_id: id, cursor: 0})).ok, false, 'external Domain.put replacements undergo full static decoding')
      assert.equal(table.get(sourceKey), damaged, 'a rejected replacement is not rewritten')
      await table.put(sourceKey, structuredClone(valid))
      assert.equal((await run('chunk', {export_id: id, cursor: 0})).ok, true)
    }
    await domain.close()
    const file = `${home}/storage/roleplay/branch/${sourceKey}.json`, document = JSON.parse(readFileSync(file, 'utf8'))
    document.record.text += 'cold damage'; writeFileSync(file, JSON.stringify(document), 'utf8')
    domain = await facility.open(spec); table = domain.table('branch'); mount()
    assert.equal((await run('chunk', {export_id: id, cursor: 0})).ok, false, 'cold medium corruption is rejected by a fresh exporter')
    assert.equal(JSON.parse(readFileSync(file, 'utf8')).record.text, document.record.text)
    await table.put(sourceKey, structuredClone(valid))
    const oldMaterial = [{label: '旧修复记录保留的正文副本', source: 'legacy-control-copy', text: '这份旧正文不属于静态快照。'}]
    const oldSnapshot = exportSnapshot(session.id, oldMaterial)
    await table.put(key, {...table.get(key), material: oldMaterial, units: oldSnapshot.units, text: oldSnapshot.text})
    await domain.close()
    domain = await facility.open(spec); table = domain.table('branch'); mount()
    assert.equal(table.get(key).text, oldSnapshot.text, 'the cold control row retains its older body fields')
    assert.deepEqual(table.get(sourceKey), valid, 'the static companion is unchanged by a control-row repair')
    const replay = await run('chunk', {export_id: id, cursor: 0})
    assert.equal(replay.ok, true)
    assert.ok(unfence(replay.text) === valid.text.slice(0, 16000), 'validated static text takes precedence over an older control copy')
    const submit = {export_id: id, expected_sha256: begun.sourceHash, title: '当前设定', sections: [{heading: '完整原文', source_ids: begun.sources.map(source => source.id)}]}
    current = current.map(item => ({...item, text: item.text + '当前设定已修改。'}))
    assert.match((await run('finalize', submit)).error, /设定在导出期间已修改/, 'static decoding reuse does not replace the current-source check')
    current = structuredClone(valid.material)
    const done = await run('finalize', submit); assert.equal(done.ok, true)
    assert.equal(readFileSync(done.file, 'utf8'), renderOrganizedExport(valid, submit.title, submit.sections))
    console.log('card-export-domain=ok (shared DATA identity, cold cursor resume, authoritative static body, replacement/cold damage, workflow and current-source gates)')
  } finally {
    await domain?.close(); await backend.close(); cleanupTestDirectory(home)
  }
}
