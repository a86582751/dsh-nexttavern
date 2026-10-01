import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { exportSnapshot, renderOrganizedExport, registerCardExport } from '../lib/core/card-export.js'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createTestDirectory, cleanupTestDirectory } from '../lib/operations/test-temp.mjs'
import { stableJson as exportJson } from '../lib/core/card-export-projection.js'
import { stableJson as recordJson, recordSha256 } from '../lib/core/roleplay-data.js'

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
  const writes = []; let failCompleted = false
  registerCardExport({
    tools: { register(tool) { tools.set(tool.name, tool); return () => tools.delete(tool.name) } },
    effect(work) { effects.push(work()) },
  }, {
    simpleTool: (name, description, parameters, execute) => ({ name, description, parameters, execute }),
    sessionOf: exec => exec?.agent?.session ?? session,
    table: { get: key => records.get(key), entries: () => records.entries(), async put(key, value) {
      if (failCompleted && value.status === 'completed') { failCompleted = false; throw Error('injected durable failure') }
      writes.push(value.status); records.set(key, structuredClone(value))
    } },
    collect: () => material,
    lock: async (id, scope, work) => { assert.equal(scope, 'export'); return await work() },
    workflowOf: () => 'workflow-export',
    onCompleted: async (_session, value) => { assert.equal(records.get(`${session.id}__export-${value.exportId}`).status, 'completed'); return { id: 'resource-1', name: 'card.md' } },
  })
  const finalize = tools.get('rp_card_export_finalize')
  // Registered schema and model-facing description from pre-migration 7e6ff13.
  assert.equal(createHash('sha256').update(JSON.stringify([...tools.values()])).digest('hex'), '8089871feb72e8e8b92fed0cae9c79632a5f51e351975748884c1ee53eec4650')
  assert.deepEqual(finalize.parameters.properties.sections.items.required, ['heading'])
  assert.deepEqual(finalize.parameters.properties.sections.items.properties.source_parts.items.required, ['source_id', 'start_line', 'end_line'])
  assert(effects.every(dispose => typeof dispose === 'function'), 'host owns registration disposers')
  const run = (name, args, exec) => tools.get(`rp_card_export_${name}`).execute(args, exec)
  const begun = await run('begin', {})
  assert.equal(begun.ok, true, 'unrelated null records must not prevent begin')
  const id = begun.exportId, key = `${session.id}__export-${id}`
  assert.equal((await run('begin', {})).exportId, id, 'resume existing workflow')
  assert.equal((await run('chunk', { export_id: id, cursor: 1 })).ok, false, 'cannot skip initial page')
  const submit = { export_id: id, expected_sha256: begun.sourceHash, title: 'Export', sections: [{ heading: 'All', source_ids: begun.sources.map(source => source.id) }] }
  assert.equal((await run('finalize', submit)).ok, false, 'must review full source')
  let cursor = 0
  do { const page = await run('chunk', { export_id: id, cursor }); assert.equal(page.ok, true); cursor = page.nextCursor } while (cursor !== null)
  const beforeInvalid = structuredClone(records.get(key))
  assert.equal((await run('chunk', { export_id: id, source_id: 1, cursor: 0 })).ok, false, 'invalid source_id must not silently use cursor')
  assert.deepEqual(records.get(key), beforeInvalid)
  assert.equal((await run('chunk', { export_id: id, cursor: 0 }, { agent: { session: { ...session, id: 'other' } } })).ok, false)
  failCompleted = true
  assert.equal((await run('finalize', submit)).ok, false)
  assert.equal(records.get(key).status, 'committing', 'failed durable completion remains recoverable')
  const done = await run('finalize', submit)
  assert.equal(done.ok, true); assert.equal(done.resourceId, 'resource-1')
  const bytes = readFileSync(done.file, 'utf8')
  assert.equal(bytes, renderOrganizedExport(records.get(key), submit.title, submit.sections))
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
