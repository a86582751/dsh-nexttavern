import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import {testTempRoot as tmpdir} from '../lib/operations/test-temp.mjs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {deflateSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {decodeTavernCard, projectTavernCard, pngCrc} from '../lib/core/tavern-card.js'

class MockTable {
  constructor(name) {
    this.name = name
    this.data = new Map()
    this.failPut = null
  }

  get(key) {
    // Deliberately return the live object: the real storage-domain API does so,
    // and the importer must never mutate it before a successful put.
    return this.data.get(key)
  }

  entries() {
    return this.data.entries()
  }

  async put(key, value) {
    if (this.failPut?.(key, value)) {
      this.failPut = null
      throw new Error(`injected put failure: ${this.name}:${key}`)
    }
    this.data.set(key, JSON.parse(JSON.stringify(value)))
  }

  async delete(key) {
    this.data.delete(key)
  }
}

async function createHarness(modulePath, workspace) {
  const tools = new Map()
  const commands = new Map()
  const fetchRoutes = []
  const promptSections = new Map()
  const tables = new Map()
  const tableNames = [
    'branch', 'cards', 'worldbook', 'memory', 'scene', 'rolls',
    'status', 'rules', 'opening', 'drafts', 'userinfo', 'decision',
  ]
  for (const name of tableNames) tables.set(name, new MockTable(name))
  const session = {
    id: 'session-card-import-test',
    header: { agentPreset: 'roleplay', cwd: workspace },
    log: [],
    seq: 1,
    surface: { nodes: [] },
  }
  const sessions = new Map([[session.id, session]])
  const ctx = {
    storageDomain: {
      async open() {
        return { table: (name) => tables.get(name), close() {} }
      },
    },
    effect(callback) {
      callback()
      return () => {}
    },
    provide(name, value) {
      this[name] = value
    },
    on() {
      return () => {}
    },
    systemPrompt: {
      variable() { return () => {} },
      section(section) { promptSections.set(section.name,section); return () => {} },
    },
    tools: {
      register(tool) {
        tools.set(tool.name, tool)
        return () => tools.delete(tool.name)
      },
    },
    commands: {
      register(command) {
        commands.set(command.name, command)
        return () => commands.delete(command.name)
      },
    },
    connection: {
      fetch: {
        register(route) {
          fetchRoutes.push(route)
          return () => {}
        },
      },
    },
      sessions: { get: (id) => sessions.get(id) },
      // Production provides this from the owned session-format addon; the
      // loaded view supplies the same contract so edit recovery can run.
      nexttavernMessageEdits: {
        append: (session, targetSeq, identity, text) =>
          session.append('roleplay/message-edit', { schemaVersion: 1, targetSeq, ...identity, text }),
        latest: (events, targetSeq) => {
          for (let index = events.length - 1; index >= 0; index--) {
            const event = events[index]
            if (event?.type === 'roleplay/message-edit' && event.data?.targetSeq === targetSeq) return event
          }
          return null
        },
        current: (_session, events) => [...new Map(events
          .filter(event => event?.type === 'roleplay/message-edit')
          .map(event => [event.data.targetSeq, event])).values()],
      },
      sessionController:{async resolveAgent(id){return {agent:{session:sessions.get(id),options:{provider:'fixture',model:'main'}}}}},
    userQuestions: {
      async ask({ questions }) {
        assert.deepEqual(questions.map(question => question.id), ['reading-mode'])
        return { answers: [{ id: 'reading-mode', selected: ['精读'] }] }
      },
    },
    get(name){return this[name]},
    llm: {},
    fs: {},
    tokenMeter: {},
    subagents: {},
    agentDefaultModel: { currentSelection: () => ({provider:'fixture',model:'main'}) },
    logger: { info() {}, warn() {} },
  }
  const module = await import(`${pathToFileURL(modulePath).href}?test=${Date.now()}`)
  await module.apply(ctx, {})
  const execute = async (name, args) => {
    const tool = tools.get(name)
    assert.ok(tool, `missing tool ${name}`)
    const result = await tool.execute(args, { agent: { session } })
    assert.deepEqual(result, JSON.parse(JSON.stringify(result)), `${name} output must be lossless JSON`)
    return result
  }
  return { ctx, execute, tables, session, tools, promptSections, sessions, fetchRoutes }
}

function writeLines(path, lines, finalNewline = false) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${lines.join('\n')}${finalNewline ? '\n' : ''}`, 'utf8')
}

async function readAll(execute, importId, lineCount) {
  let cursor = 1
  while (cursor !== null) {
    const result = await execute('rp_card_import_chunk', { import_id: importId, cursor, max_lines: 20 })
    assert.equal(result.ok, true)
    cursor = result.nextCursor
  }
  assert.equal(lineCount > 0, true)
}

const scratch = mkdtempSync(join(tmpdir(), 'dsh-card-import-'))
try {
  const modulePath = process.argv[2]
    ? String(process.argv[2])
    : join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'core', 'roleplay-core.js')
  const harness = await createHarness(modulePath, scratch)
  const nativeResult=(callId,body)=>({source:{kind:'tool',callId},content:[{type:'tool-result',toolCallId:callId,content:[{type:'text',text:JSON.stringify(body)}]}]})
  // Status is read-only: ordinary existing-card import remains available.
  writeFileSync(join(scratch,'status-only-card.md'),'# 现成卡\n', 'utf8')
  const statusOnly=await createHarness(modulePath,scratch)
  statusOnly.session.log=[{seq:0,type:'turn/start',data:{turn:1}},{seq:1,type:'tool/call',data:{turn:1,name:'rp_source_status',callId:'status'}},{seq:2,type:'tool/result',data:{turn:1,message:nativeResult('status',{sources:[]})}}]
  assert.equal((await statusOnly.execute('rp_card_import_begin',{source_file:'status-only-card.md'})).ok,true)
  // A successful novel-adaptation start fences incomplete work: it cannot be
  // relabelled as an existing card.
  writeFileSync(join(scratch,'blocked-draft.md'),'# 未完成改编草稿\n', 'utf8')
  writeFileSync(join(scratch,'blocked-source.txt'),'原著尚未读完。\n', 'utf8')
  const blockedSource=await harness.tools.get('rp_source_begin').execute({source_path:'blocked-source.txt'},{agent:{session:harness.session}})
  harness.session.log=[
    {seq:0,type:'turn/start',data:{turn:1}},
    {seq:1,type:'tool/call',data:{turn:1,name:'rp_source_begin',callId:'adapt-begin'}},
    {seq:2,type:'tool/result',data:{turn:1,message:nativeResult('adapt-begin',{sourceId:blockedSource.sourceId})}},
  ]
  await assert.rejects(harness.execute('rp_card_import_begin',{source_file:'blocked-draft.md'}),/小说研究尚未完成/)
  harness.session.log=[]
  // Finished research may materialize a complete Markdown card and import it
  // without falsely treating that handoff as abandoning the adaptation.
  const finished=await createHarness(modulePath,scratch)
  writeFileSync(join(scratch,'adaptation-source.txt'),'原著事实：角色仍有选择。\n','utf8')
  writeFileSync(join(scratch,'adapted-card.md'),'# 完成的改编卡\n','utf8')
  const adaptationSource=await finished.tools.get('rp_source_begin').execute({source_path:'adaptation-source.txt'},{agent:{session:finished.session}})
  finished.session.log=[{seq:0,type:'turn/start',data:{turn:1}},{seq:1,type:'tool/call',data:{turn:1,name:'rp_source_begin',callId:'finished-begin'}},{seq:2,type:'tool/result',data:{turn:1,message:nativeResult('finished-begin',{sourceId:adaptationSource.sourceId})}}]
  await finished.execute('rp_source_read',{source_id:adaptationSource.sourceId,segment:0})
  await finished.tools.get('rp_source_note').execute({source_id:adaptationSource.sourceId,segment:0,facts:'角色仍有选择。',implications:'可以改写选择。',questions:'无。',evidence:'角色仍有选择'},{agent:{session:finished.session}})
  await finished.tools.get('rp_source_finish').execute({source_id:adaptationSource.sourceId},{agent:{session:finished.session}})
  const adaptedImport=await finished.execute('rp_card_import_begin',{source_file:'adapted-card.md'})
  assert.equal(adaptedImport.ok,true,JSON.stringify(adaptedImport))
  // Explicit close returns to ordinary card workflows even with retained source data.
  const exited=await createHarness(modulePath,scratch)
  exited.session.log=[{seq:0,type:'tool/call',data:{turn:1,name:'rp_source_begin',callId:'exit-begin'}},{seq:1,type:'tool/result',data:{turn:1,message:nativeResult('exit-begin',{sourceId:'b'.repeat(64)})}}]
  await exited.execute('rp_source_close',{mode:'authoring'})
  exited.session.log.push({seq:2,type:'tool/call',data:{turn:1,name:'rp_source_close',callId:'exit-close'}},{seq:3,type:'tool/result',data:{turn:1,message:nativeResult('exit-close',{ok:true,mode:'authoring'})}})
  assert.equal((await exited.execute('rp_card_import_begin',{source_file:'status-only-card.md'})).ok,true)
  // Interactive authoring emits status HTML and CSS as separate source blocks.
  // Import must preserve the combined snapshot, and reject truncated assets
  // before committing either the card or its state.
  for (const broken of [false, true]) {
    const scoped = await createHarness(modulePath, scratch)
    const status = '# 状态栏\n```html\n<section class="status-grid">⟦位置⟧</section>\n```\n```css\n.status-grid{display:grid;background:#fcfbfa}\n' + (broken ? '' : '```\n')
    const source = '# 测试人物\n角色资料\n' + status
    const filename = broken ? 'status-css-broken.md' : 'status-css-complete.md'
    writeFileSync(join(scratch,filename),source)
    const begin = await scoped.execute('rp_card_import_begin',{source_file:filename,mode:'replace'})
    assert.equal(begin.ok,true)
    let cursor=1
    while(cursor!==null) cursor=(await scoped.execute('rp_card_import_chunk',{import_id:begin.importId,cursor,max_lines:300})).nextCursor
    const staged=await scoped.execute('rp_card_import_stage',{import_id:begin.importId,assignments:[
      {target:'card',name:'测试人物',sourceSpans:[{startLine:1,endLine:2}]},
      {target:'status',sourceSpans:[{startLine:3,endLine:begin.lineCount}]},
    ]})
    assert.equal(staged.ok,true)
    const result=await scoped.execute('rp_card_import_finalize',{import_id:begin.importId,expected_sha256:begin.normalizedSha256})
    assert.equal(result.ok,!broken)
    const saved=scoped.tables.get('status').get(`${scoped.session.id}__spec`)
    if (broken) {
      assert.match(result.error,/CSS.*未闭合/)
      assert.equal(saved,undefined,'bad assets must not partially activate a status spec')
      assert.equal(scoped.tables.get('cards').data.size,0,'bad assets must not partially activate characters')
    } else {
      assert.equal(saved.templateHtml,status,'status CSS and HTML preserve their original source blocks')
      assert.equal(saved.text,saved.templateHtml)
      assert.ok(saved.sources.length>0,'source provenance remains available')
      const misplaced = await createHarness(modulePath,scratch)
      const next = await misplaced.execute('rp_card_import_begin',{source_file:filename,mode:'replace'})
      let nextCursor=1
      while(nextCursor!==null) nextCursor=(await misplaced.execute('rp_card_import_chunk',{import_id:next.importId,cursor:nextCursor,max_lines:300})).nextCursor
      assert.equal((await misplaced.execute('rp_card_import_stage',{import_id:next.importId,assignments:[
        {target:'card',name:'测试人物',sourceSpans:[{startLine:1,endLine:2}]},
        {target:'status',sourceSpans:[{startLine:3,endLine:6}]},
        {target:'archive-only',sourceSpans:[{startLine:7,endLine:next.lineCount}]},
      ]})).ok,true)
      const rejected=await misplaced.execute('rp_card_import_finalize',{import_id:next.importId,expected_sha256:next.normalizedSha256})
      assert.equal(rejected.ok,false,'100% source coverage cannot hide CSS misclassification')
      assert.match(rejected.error,/配套 CSS 未归入 status/)
      assert.equal(misplaced.tables.get('cards').data.size,0)
    }
  }
  {
    const route=harness.fetchRoutes.find(r=>r.path==='/api/roleplay/memory-settings')
    assert.ok(route,'memory window settings must expose global and session policy')
    const read=()=>route.fetch(new Request(`https://fixture.test/api/roleplay/memory-settings?sessionId=${harness.session.id}`)).then(r=>r.json())
    const save=body=>route.fetch(new Request('https://fixture.test/api/roleplay/memory-settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:harness.session.id,...body})}))
    let policy=await read()
    assert.equal(policy.effective.contextWindowTokens,230000)
    assert.equal((await save({scope:'global',expectedRevision:policy.global.revision,settings:{contextWindowTokens:60000,autoNotesEveryTurns:5}})).status,200)
    assert.equal((await save({scope:'global',expectedRevision:policy.global.revision,settings:{autoNotesEveryTurns:2}})).status,409)
    policy=await read();assert.equal(policy.effective.autoNotesEveryTurns,5)
    assert.equal((await save({scope:'session',expectedRevision:policy.session.revision,settings:{autoNotesEveryTurns:2}})).status,200)
    policy=await read();assert.equal(policy.effective.autoNotesEveryTurns,2);assert.equal(policy.effective.contextWindowTokens,60000)
    assert.equal(policy.global.settings.autoNotesEveryTurns,5)
    assert.equal((await save({scope:'session',expectedRevision:policy.session.revision,settings:{contextWindowTokens:25}})).status,400)
    assert.equal((await save({scope:'session',expectedRevision:policy.session.revision,settings:{autoNotesEveryTurns:null}})).status,200)
    policy=await read();assert.equal(policy.effective.autoNotesEveryTurns,5)
    await save({scope:'global',expectedRevision:policy.global.revision,settings:{contextWindowTokens:null,autoNotesEveryTurns:null}})
  }
  {
    // The ordinary-player entry must exist before any tool is chosen, even in
    // an empty session; a detailed test prompt cannot supply this workflow.
    const section=harness.promptSections.get('roleplay:card-workflows')
    assert.ok(section,'runtime must own the import/export workflow before the first tool call')
    const prompt=section.text({agent:{session:harness.session}})
    for(const phrase of ['读取这张角色卡','导出角色卡','rp_card_import_begin','rp_card_export_begin','rp_card_export_chunk','rp_card_export_finalize','最新','不精简','nextCursor','use_suggested'])assert.ok(prompt.includes(phrase),`missing default workflow: ${phrase}`)
    for(const phrase of ['视角、镜头、细节密度、节奏、人物知情边界','rule-narrative','rule-reply','人物知情限制不是低频世界书','系统自己保障']){
      assert.ok(prompt.includes(phrase));assert.ok(harness.tools.get('rp_card_import_stage').description.includes(phrase),'tool itself must teach semantic classification')
    }
    for(const phrase of ['核心设定','剧情指引','文风特化','世界书','被动资料库','尚未发生']){
      for(const target of [prompt,harness.tools.get('rp_card_import_stage').description,harness.tools.get('rp_card_export_finalize').description])assert.ok(target.includes(phrase),`missing shared import/export concept: ${phrase}`)
    }
    assert.equal(section.text({agent:{session:{header:{agentPreset:'deepseek'}}}}),'','ordinary agents do not receive roleplay workflow')
  }
  {
    const tavern = await createHarness(modulePath, scratch)
    const data = {spec:'chara_card_v3',spec_version:'3.0',vendor_extension:{keep:'wrapper-source-preserved'},data:{name:'Native Tavern',description:'Full character details.',
      first_mes:'Original opening.',extensions:{kept:true},character_book:{entries:[{keys:['tower'],content:'Seven steps.',enabled:false}]}}}
    writeFileSync(join(scratch,'native-card.json'),JSON.stringify(data))
    const begin = await tavern.execute('rp_card_import_begin',{source_file:'native-card.json'})
    assert.equal(begin.ok,true,'native import must accept structured JSON without anydoc')
    assert.equal(begin.format,'json-v3')
    const importKey=`${tavern.session.id}__import-${begin.importId}`
    const importedRecord=tavern.tables.get('branch').get(importKey)
    assert.equal(importedRecord.schemaVersion,5)
    assert.equal(importedRecord.normalizer,'tavern-fields-v2')
    assert.ok(importedRecord.rawSource.includes('wrapper-source-preserved'))
    assert.ok(!importedRecord.normalizedSource.includes('wrapper-source-preserved'),'new compact projection avoids duplicating the full structured JSON')
    assert.equal((await tavern.execute('rp_card_import_stage',{import_id:begin.importId,use_suggested:true})).ok,false,'review remains mandatory')
    let cursor=1
    while(cursor!==null) cursor=(await tavern.execute('rp_card_import_chunk',{import_id:begin.importId,cursor,max_lines:300})).nextCursor
    const staged=await tavern.execute('rp_card_import_stage',{import_id:begin.importId,use_suggested:true,resource_title:'雾港灯塔：值守者与七级台阶'})
    assert.equal(staged.ok,true); assert.equal(staged.coverage,1)
    const result=await tavern.execute('rp_card_import_finalize',{import_id:begin.importId,expected_sha256:begin.normalizedSha256})
    assert.equal(result.ok,true,result.error)
    assert.ok([...tavern.tables.get('branch').data.values()].some(r=>r?.name==='雾港灯塔：值守者与七级台阶.json'),'import archives use the LLM thematic title while retaining original bytes')
    const entry=[...tavern.tables.get('worldbook').data.values()][0]
    assert.equal(entry.enabled,false,'disabled imported lore must not silently become enabled')
    const cardKey=[...tavern.tables.get('cards').data.keys()][0]
    await tavern.tables.get('cards').put(cardKey,{...tavern.tables.get('cards').get(cardKey),content:'Latest user edit with complete new details.'})
    const exp=await tavern.execute('rp_card_export_begin',{})
    assert.equal(exp.ok,true)
    const sections=exp.sources.map(u=>({heading:u.label,source_ids:[u.id]}))
    const finalize={export_id:exp.exportId,expected_sha256:exp.sourceHash,title:'统一角色卡',sections}
    assert.equal((await tavern.execute('rp_card_export_finalize',finalize)).ok,false,'export also requires complete LLM review')
    let exportCursor=0
    while(exportCursor!==null)exportCursor=(await tavern.execute('rp_card_export_chunk',{export_id:exp.exportId,cursor:exportCursor})).nextCursor
    assert.equal((await tavern.execute('rp_card_export_finalize',{...finalize,sections:sections.slice(1)})).ok,false,'missing a source is rejected')
    tavern.tables.get('branch').failPut=(_key,value)=>value.status==='completed'
    assert.equal((await tavern.execute('rp_card_export_finalize',finalize)).ok,false,'injected commit failure leaves a recoverable prepared export')
    assert.equal(tavern.tables.get('branch').get(`${tavern.session.id}__export-${exp.exportId}`).status,'committing')
    const exported=await tavern.execute('rp_card_export_finalize',finalize)
    assert.equal(exported.ok,true)
    assert.equal(exported.filename,'统一角色卡.md','completion exposes the thematic filename rather than only a UUID path')
    assert.equal(tavern.tables.get('branch').get(`${tavern.session.id}__export-${exp.exportId}`).title,'统一角色卡')
    const md=readFileSync(exported.file,'utf8')
    assert.ok(md.includes('Latest user edit with complete new details.'))
    assert.ok(!md.includes('Full character details.'),'old raw card must not overwrite or reintroduce edited content')
    assert.ok(md.includes('Original opening.'))
    assert.ok(md.includes('wrapper-source-preserved'),'wrapper-level extensions survive current-data export')
    assert.equal((await tavern.execute('rp_card_export_finalize',finalize)).sha256,exported.sha256,'retry is idempotent')
    writeLines(join(scratch,'extra.md'),['补充人物衣饰','新附录完整内容'])
    const extra=await tavern.execute('rp_card_import_begin',{source_file:'extra.md',mode:'merge'})
    await readAll(tavern.execute,extra.importId,extra.lineCount)
    assert.equal((await tavern.execute('rp_card_import_stage',{import_id:extra.importId,assignments:[{target:'card',id:'extra',sourceSpans:[{startLine:1,endLine:1}]},{target:'archive-only',sourceSpans:[{startLine:2,endLine:2}]}]})).ok,true)
    assert.equal((await tavern.execute('rp_card_import_finalize',{import_id:extra.importId,expected_sha256:extra.normalizedSha256})).ok,true)
    const exp2=await tavern.execute('rp_card_export_begin',{})
    const pendingExport=tavern.tables.get('branch').get(`${tavern.session.id}__export-${exp2.exportId}`)
    assert.match(pendingExport.text,/wrapper-source-preserved/,'an earlier structured import keeps its extras after MD merge')
    assert.match(pendingExport.text,/新附录完整内容/)
    exportCursor=0
    while(exportCursor!==null)exportCursor=(await tavern.execute('rp_card_export_chunk',{export_id:exp2.exportId,cursor:exportCursor})).nextCursor
    await tavern.tables.get('cards').put(cardKey,{...tavern.tables.get('cards').get(cardKey),content:'Edited during export.'})
    assert.equal((await tavern.execute('rp_card_export_finalize',{...finalize,export_id:exp2.exportId,expected_sha256:exp2.sourceHash})).ok,false,'edits before commit require a new export snapshot')
    assert.equal((await tavern.execute('rp_card_export_finalize',finalize)).sha256,exported.sha256,'completed export remains an immutable historical artifact')
  }
  {
    // Previously persisted schema-v4 records retain their old full projection
    // and can still be reviewed, staged, finalized, and loaded as active data.
    const legacy=await createHarness(modulePath,scratch)
    const document={spec:'chara_card_v3',spec_version:'3.0',data:{name:'Legacy V1 card',description:'Legacy full source remains readable.',first_mes:'The old lantern is lit.',unknown_extension:{preserved:true}}}
    writeFileSync(join(scratch,'legacy-v1.json'),JSON.stringify(document))
    const begin=await legacy.execute('rp_card_import_begin',{source_file:'legacy-v1.json'})
    assert.equal(begin.ok,true)
    const key=`${legacy.session.id}__import-${begin.importId}`
    const record=legacy.tables.get('branch').get(key)
    const decoded=decodeTavernCard(Buffer.from(JSON.stringify(document)),'.json')
    const oldProjection=projectTavernCard(decoded)
    const normalizedSource=oldProjection.text
    const lines=normalizedSource.split('\n')
    if(normalizedSource.endsWith('\n'))lines.pop()
    const lineStarts=[];let offset=0
    for(const line of lines){lineStarts.push(offset);offset+=line.length+1}
    const sha256=value=>createHash('sha256').update(value).digest('hex')
    Object.assign(record,{schemaVersion:4,normalizer:'tavern-fields-v1',normalizedSource,lines,lineStarts,
      lineCount:lines.length,normalizedChars:normalizedSource.length,normalizedSha256:sha256(normalizedSource),
      readRanges:[],nextReadCursor:1,reviewComplete:false,assignments:[]})
    await legacy.tables.get('branch').put(key,record)
    await readAll(legacy.execute,begin.importId,lines.length)
    const staged=await legacy.execute('rp_card_import_stage',{import_id:begin.importId,use_suggested:true})
    assert.equal(staged.ok,true,staged.error)
    legacy.tables.get('cards').failPut=()=>true
    const interrupted=await legacy.execute('rp_card_import_finalize',{import_id:begin.importId,expected_sha256:sha256(normalizedSource)})
    assert.equal(interrupted.ok,false,'schema-v4 activation must keep rollback available after a failed write')
    assert.equal(legacy.tables.get('cards').data.size,0,'failed schema-v4 activation rolls back partial card writes')
    const finalized=await legacy.execute('rp_card_import_finalize',{import_id:begin.importId,expected_sha256:sha256(normalizedSource)})
    assert.equal(finalized.ok,true,finalized.error)
    const active=legacy.tables.get('branch').get(`${legacy.session.id}__import-active`)
    assert.equal(active.importId,begin.importId)
    assert.equal(legacy.tables.get('branch').get(key).schemaVersion,4,'finalized legacy records remain readable in their original schema')
    assert.ok([...legacy.tables.get('cards').data.values()].some(item=>item.content.includes('Legacy full source remains readable.')))
  }
  const { execute, tables, session } = harness

  assert.deepEqual(harness.tools.get('rp_card_import_stage').parameters.properties.assignments.items.properties.target.enum,
    ['card', 'worldbook', 'status', 'core-setting', 'plot-guidance', 'rule-narrative', 'rule-reply', 'rule-style',
      'opening', 'beauty-css', 'beauty-js', 'beauty-regex', 'archive-only'],
    'native import schema must expose every accepted target so callers never have to guess column names')

  const outside = join(tmpdir(), `outside-card-${Date.now()}.md`)
  writeFileSync(outside, '# outside', 'utf8')
  const outsideBegin = await execute('rp_card_import_begin', { source_file: outside })
  assert.equal(outsideBegin.ok, false)
  assert.match(outsideBegin.error, /当前会话工作区/)
  rmSync(outside, { force: true })

  const lines = Array.from({ length: 50 }, (_unused, index) => `原文第${index + 1}行`)
  lines[0] = '\\# 甲角色'
  lines[10] = '# 乙角色'
  lines[20] = '# 世界设定'
  lines[23] = ''
  lines[25] = '# 叙事规则'
  lines[30] = '# 状态栏'
  lines[34] = '# 开场'
  lines[40] = '[{"match":"第(\\\\d+)页","replace":"<h2>第$1页</h2>"}]'
  lines[41] = '.chapter { color: #9B59B6; }'
  lines[44] = 'root.dataset.cardReady = "1";'
  lines[47] = '# 暂未识别的附录'
  // Only unmistakable line-leading Markdown escapes are defensive.  These
  // inline/code/path backslashes must survive normalization byte-for-byte.
  lines[6] = String.raw`正文里的 \[literal\] 与 \path\to\card`
  lines[7] = String.raw`正文里的 \<not-a-tag\> 与 LaTeX \[x\]`
  lines[8] = String.raw`行内 HTML：\<span class="voice"\>台词\</span\>`
  lines[9] = String.raw`状态角色：\{\{user\}\}`
  const source = join(scratch, '.dsh-card-imports', 'full-card.md')
  writeLines(source, lines, true)

  const begin = await execute('rp_card_import_begin', { source_file: '.dsh-card-imports/full-card.md', mode: 'replace' })
  assert.equal(begin.ok, true)
  assert.equal(begin.lineCount, 50)
  assert.equal(begin.reviewComplete, false)
  assert.equal(begin.nextCursor, 1)

  const prematureStage = await execute('rp_card_import_stage', {
    import_id: begin.importId,
    assignments: [{ target: 'card', name: '甲角色', sourceSpans: [{ startLine: 1, endLine: 50 }] }],
  })
  assert.equal(prematureStage.ok, false)
  assert.match(prematureStage.error, /连续审阅完成/)

  const page1 = await execute('rp_card_import_chunk', { import_id: begin.importId, cursor: 1, max_lines: 20 })
  assert.equal(page1.ok, true)
  assert.equal(page1.nextCursor, 21)
  assert.match(page1.numberedText, /^1\t# 甲角色/m)
  const page1Retry = await execute('rp_card_import_chunk', { import_id: begin.importId, cursor: 1, max_lines: 20 })
  assert.equal(page1Retry.ok, true)
  assert.equal(page1Retry.nextCursor, 21)
  const skippedPage = await execute('rp_card_import_chunk', { import_id: begin.importId, cursor: 41, max_lines: 20 })
  assert.equal(skippedPage.ok, false)
  assert.match(skippedPage.error, /不得跳页/)
  const page2 = await execute('rp_card_import_chunk', { import_id: begin.importId, cursor: 21, max_lines: 20 })
  assert.equal(page2.nextCursor, 41)
  const page3 = await execute('rp_card_import_chunk', { import_id: begin.importId, cursor: 41, max_lines: 20 })
  assert.equal(page3.nextCursor, null)
  assert.equal(page3.reviewComplete, true)

  const duplicateTarget = await execute('rp_card_import_stage', {
    import_id: begin.importId,
    replace_all: true,
    assignments: [
      { target: 'card', name: '同名角色', sourceSpans: [{ startLine: 1, endLine: 10 }] },
      { target: 'card', name: '同名角色', sourceSpans: [{ startLine: 11, endLine: 20 }] },
    ],
  })
  assert.equal(duplicateTarget.ok, false)
  assert.match(duplicateTarget.error, /重复导入目标/)

  const incompleteStage = await execute('rp_card_import_stage', {
    import_id: begin.importId,
    replace_all: true,
    assignments: [
      { target: 'card', name: '甲角色', sourceSpans: [{ startLine: 1, endLine: 10 }] },
      { target: 'archive-only', name: '其余原文', sourceSpans: [{ startLine: 11, endLine: 49 }] },
    ],
  })
  assert.equal(incompleteStage.ok, true)
  assert.ok(incompleteStage.coverage < 1)
  const incompleteFinalize = await execute('rp_card_import_finalize', { import_id: begin.importId, expected_sha256: begin.normalizedSha256 })
  assert.equal(incompleteFinalize.ok, false)
  assert.match(incompleteFinalize.error, /未达到原文字符 100%/)

  const assignments = [
    // The two assignments deliberately interleave.  Materialization must
    // flatten every span and restore source order, not merely sort by each
    // assignment's first span.
    { target: 'card', name: '甲角色', kind: 'npc', merge_group: 'character-a', order: 1, sourceSpans: [{ startLine: 1, endLine: 2 }, { startLine: 6, endLine: 10 }] },
    { target: 'card', name: '甲角色', kind: 'npc', merge_group: 'character-a', order: 99, sourceSpans: [{ startLine: 3, endLine: 5 }] },
    { target: 'card', name: '乙角色', kind: 'npc', order: 2, sourceSpans: [{ startLine: 11, endLine: 20 }] },
    { target: 'worldbook', name: '核心世界', kind: 'world', keywords: ['世界'], order: 3, sourceSpans: [{ startLine: 21, endLine: 25 }] },
    { target: 'rule-narrative', order: 4, sourceSpans: [{ startLine: 26, endLine: 30 }] },
    { target: 'status', order: 5, sourceSpans: [{ startLine: 31, endLine: 34 }] },
    { target: 'opening', order: 6, sourceSpans: [{ startLine: 35, endLine: 40 }] },
    { target: 'beauty-regex', order: 7, sourceSpans: [{ startLine: 41, endLine: 41 }] },
    { target: 'beauty-css', order: 8, sourceSpans: [{ startLine: 42, endLine: 44 }] },
    { target: 'beauty-js', order: 9, sourceSpans: [{ startLine: 45, endLine: 47 }] },
    { target: 'archive-only', name: '未识别附录', order: 10, sourceSpans: [{ startLine: 48, endLine: 50 }] },
  ]
  const stage = await execute('rp_card_import_stage', { import_id: begin.importId, replace_all: true, assignments })
  assert.equal(stage.ok, true)
  assert.equal(stage.coverage, 1)
  assert.equal(stage.coveredChars, stage.sourceChars)

  const wrongHash = await execute('rp_card_import_finalize', { import_id: begin.importId, expected_sha256: '0'.repeat(64) })
  assert.equal(wrongHash.ok, false)
  assert.match(wrongHash.error, /SHA-256/)

  const finalized = await execute('rp_card_import_finalize', { import_id: begin.importId, expected_sha256: begin.normalizedSha256 })
  assert.equal(finalized.ok, true)
  assert.equal(finalized.coverage, 1)
  assert.equal(finalized.archiveOnly, 1)
  assert.equal(finalized.cards.length, 2)
  assert.notEqual(finalized.cards[0], finalized.cards[1])
  assert.match(finalized.cards[0], /^entry-[a-f0-9]{16}$/)
  assert.match(finalized.cards[1], /^entry-[a-f0-9]{16}$/)
  const firstCard = tables.get('cards').get(`${session.id}__${finalized.cards[0]}`)
  const normalizedFirstLines = ['# 甲角色', ...lines.slice(1, 10)]
  normalizedFirstLines[8] = '行内 HTML：<span class="voice">台词</span>'
  normalizedFirstLines[9] = '状态角色：{{user}}'
  const normalizedFirstSection = normalizedFirstLines.join('\n')
  assert.equal(firstCard.content, `${normalizedFirstSection}\n`)
  assert.ok(firstCard.content.includes(String.raw`正文里的 \[literal\] 与 \path\to\card`))
  assert.ok(firstCard.content.includes(String.raw`正文里的 \<not-a-tag\> 与 LaTeX \[x\]`))
  assert.ok(firstCard.content.includes('行内 HTML：<span class="voice">台词</span>'))
  assert.ok(firstCard.content.includes('状态角色：{{user}}'))
  assert.equal(firstCard.sources[0].fragments[0].startOffset, 0)
  assert.equal(firstCard.sources[0].exactCopy, true)
  const rules = tables.get('rules').get(`${session.id}__spec`)
  assert.equal(rules.beauty.regexRules.length, 1)
  assert.equal(rules.beauty.regexRules[0].match, '第(\\d+)页')
  assert.equal(rules.sources.archiveOnly.length, 1)
  const idempotent = await execute('rp_card_import_finalize', { import_id: begin.importId, expected_sha256: begin.normalizedSha256 })
  assert.equal(idempotent.ok, true)
  assert.equal(idempotent.idempotent, true)

  // A source-verified supplement must not retroactively mark an existing
  // agent-authored/unverified prefix as fully verified.
  firstCard.verified = false

  const mergeLines = Array.from({ length: 25 }, (_unused, index) => `补充第${index + 1}行`)
  const mergeSource = join(scratch, '.dsh-card-imports', 'supplement.md')
  writeLines(mergeSource, mergeLines)
  const mergeBegin = await execute('rp_card_import_begin', { source_file: mergeSource, mode: 'merge' })
  await readAll(execute, mergeBegin.importId, mergeBegin.lineCount)
  const mergeStage = await execute('rp_card_import_stage', {
    import_id: mergeBegin.importId,
    assignments: [
      { target: 'card', name: '甲角色', kind: 'npc', sourceSpans: [{ startLine: 1, endLine: 5 }] },
      { target: 'archive-only', name: '补充原文', sourceSpans: [{ startLine: 6, endLine: 25 }] },
    ],
  })
  assert.equal(mergeStage.ok, true)
  const beforeBeautyHash = JSON.stringify(tables.get('rules').get(`${session.id}__spec`).beauty)
  const mergeFinal = await execute('rp_card_import_finalize', { import_id: mergeBegin.importId, expected_sha256: mergeBegin.normalizedSha256 })
  assert.equal(mergeFinal.ok, true)
  assert.equal(JSON.stringify(tables.get('rules').get(`${session.id}__spec`).beauty), beforeBeautyHash)
  const mergedCard = tables.get('cards').get(`${session.id}__${finalized.cards[0]}`)
  assert.match(mergedCard.content, /状态角色：\{\{user\}\}\n补充第1行/)
  assert.equal(mergedCard.verified, false)

  const rollbackLines = Array.from({ length: 20 }, (_unused, index) => `事务第${index + 1}行`)
  const rollbackSource = join(scratch, '.dsh-card-imports', 'rollback.md')
  writeLines(rollbackSource, rollbackLines)
  const rollbackBegin = await execute('rp_card_import_begin', { source_file: rollbackSource, mode: 'replace' })
  await readAll(execute, rollbackBegin.importId, rollbackBegin.lineCount)
  const rollbackStage = await execute('rp_card_import_stage', {
    import_id: rollbackBegin.importId,
    assignments: [{ target: 'card', id: 'transaction-card', name: '事务卡', sourceSpans: [{ startLine: 1, endLine: 20 }] }],
  })
  assert.equal(rollbackStage.ok, true)
  const priorCards = structuredClone([...tables.get('cards').data.entries()])
  tables.get('branch').failPut = (key) => key === `${session.id}__import-active`
  const rolledBack = await execute('rp_card_import_finalize', { import_id: rollbackBegin.importId, expected_sha256: rollbackBegin.normalizedSha256 })
  assert.equal(rolledBack.ok, false)
  assert.equal(rolledBack.rolledBack, true)
  const byKey = (entries) => [...entries].sort(([left], [right]) => left.localeCompare(right))
  assert.deepEqual(byKey(tables.get('cards').data.entries()), byKey(priorCards))
  const importRecord = [...tables.get('branch').data.values()].find((record) => record?.importId === rollbackBegin.importId)
  assert.equal(importRecord.status, 'staging')
  const retry = await execute('rp_card_import_finalize', { import_id: rollbackBegin.importId, expected_sha256: rollbackBegin.normalizedSha256 })
  assert.equal(retry.ok, true)

  // A failed activation must not overwrite an unrelated writer's value while
  // rolling back. Simulate another writer changing an imported key just before
  // the active-pointer write fails.
  {
    const concurrent = await createHarness(modulePath, scratch)
    const concurrentSource = join(scratch, '.dsh-card-imports', 'concurrent.md')
    writeLines(concurrentSource, ['并发事务第1行', '并发事务第2行'])
    const started = await concurrent.execute('rp_card_import_begin', { source_file: '.dsh-card-imports/concurrent.md' })
    await readAll(concurrent.execute, started.importId, started.lineCount)
    const staged = await concurrent.execute('rp_card_import_stage', {
      import_id: started.importId,
      assignments: [{ target: 'card', id: 'tx-card', name: '事务卡', sourceSpans: [{ startLine: 1, endLine: 2 }] }],
    })
    assert.equal(staged.ok, true)
    const cardKey = `${concurrent.session.id}__tx-card`
    const branchTable = concurrent.tables.get('branch')
    const cardsTable = concurrent.tables.get('cards')
    branchTable.failPut = (key) => {
      if (key === `${concurrent.session.id}__import-active`) {
        cardsTable.data.set(cardKey, { id: 'tx-card', name: '外部并发写入', content: '不要覆盖' })
        return true
      }
      return false
    }
    const unsafeRollback = await concurrent.execute('rp_card_import_finalize', {
      import_id: started.importId,
      expected_sha256: started.normalizedSha256,
    })
    assert.equal(unsafeRollback.ok, false)
    assert.equal(unsafeRollback.recoveryRequired, true)
    assert.equal(cardsTable.get(cardKey).content, '不要覆盖')
  }

  // Corrupted source metadata is detected at the commit boundary rather than
  // silently materializing a different span.
  {
    const tampered = await createHarness(modulePath, scratch)
    const tamperedSource = join(scratch, '.dsh-card-imports', 'tampered.md')
    writeLines(tamperedSource, ['完整原文'])
    const started = await tampered.execute('rp_card_import_begin', { source_file: '.dsh-card-imports/tampered.md' })
    await readAll(tampered.execute, started.importId, started.lineCount)
    await tampered.execute('rp_card_import_stage', {
      import_id: started.importId,
      assignments: [{ target: 'card', id: 'tampered-card', sourceSpans: [{ startLine: 1, endLine: 1 }] }],
    })
    const key = `${tampered.session.id}__import-${started.importId}`
    tampered.tables.get('branch').data.get(key).normalizedSource = '被篡改的原文'
    const rejected = await tampered.execute('rp_card_import_finalize', {
      import_id: started.importId,
      expected_sha256: started.normalizedSha256,
    })
    assert.equal(rejected.ok, false)
    assert.equal(rejected.recoveryRequired, true)
  }

  // Oversized metadata is rejected before the coverage loop can allocate an
  // unbounded owner map.
  {
    const bounded = await createHarness(modulePath, scratch)
    const boundedSource = join(scratch, '.dsh-card-imports', 'bounded.md')
    writeLines(boundedSource, ['一行'])
    const started = await bounded.execute('rp_card_import_begin', { source_file: '.dsh-card-imports/bounded.md' })
    await readAll(bounded.execute, started.importId, started.lineCount)
    const tooMany = Array.from({ length: 4097 }, () => ({ target: 'archive-only', sourceSpans: [{ startLine: 1, endLine: 1 }] }))
    const rejected = await bounded.execute('rp_card_import_stage', { import_id: started.importId, assignments: tooMany })
    assert.equal(rejected.ok, false)
    assert.match(rejected.error, /assignment 数量超过上限/)
  }

  // A stored "reviewComplete" flag is not trusted on its own: the durable
  // ranges must still form one hash-bound chain from line 1 through EOF.
  {
    const proof = await createHarness(modulePath, scratch)
    const proofSource = join(scratch, '.dsh-card-imports', 'review-proof.md')
    writeLines(proofSource, Array.from({ length: 21 }, (_unused, index) => `审阅第${index + 1}行`))
    const started = await proof.execute('rp_card_import_begin', { source_file: '.dsh-card-imports/review-proof.md' })
    await readAll(proof.execute, started.importId, started.lineCount)
    const key = `${proof.session.id}__import-${started.importId}`
    proof.tables.get('branch').data.get(key).readRanges[0].endLine = 19
    const rejected = await proof.execute('rp_card_import_stage', {
      import_id: started.importId,
      assignments: [{ target: 'card', id: 'proof-card', sourceSpans: [{ startLine: 1, endLine: 21 }] }],
    })
    assert.equal(rejected.ok, false)
    assert.match(rejected.error, /审阅证明/)
  }

  // Idempotent finalize also verifies the active pointer, classification
  // provenance and every material digest; it must not bless a corrupted
  // activation record merely because the source hash still matches.
  {
    const active = await createHarness(modulePath, scratch)
    const activeSource = join(scratch, '.dsh-card-imports', 'active-proof.md')
    writeLines(activeSource, ['活动证明'])
    const started = await active.execute('rp_card_import_begin', { source_file: '.dsh-card-imports/active-proof.md' })
    await readAll(active.execute, started.importId, started.lineCount)
    await active.execute('rp_card_import_stage', {
      import_id: started.importId,
      assignments: [{ target: 'card', id: 'active-card', sourceSpans: [{ startLine: 1, endLine: 1 }] }],
    })
    const finalized = await active.execute('rp_card_import_finalize', {
      import_id: started.importId,
      expected_sha256: started.normalizedSha256,
    })
    assert.equal(finalized.ok, true)
    const pointerKey = `${active.session.id}__import-active`
    active.tables.get('branch').data.get(pointerKey).transactionId = 'tampered-transaction'
    const rejected = await active.execute('rp_card_import_finalize', {
      import_id: started.importId,
      expected_sha256: started.normalizedSha256,
    })
    assert.equal(rejected.ok, false)
    assert.equal(rejected.recoveryRequired, true)
  }

  // The standalone replay script must use the same conservative normalizer as
  // the importer and preserve inline/code/path backslashes.
  {
    const deescapePath = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'preset', 'deescape-md.mjs')
    const scriptSource = join(scratch, '.dsh-card-imports', 'script-check.md')
    const scriptText = '\uFEFF' + [
      String.raw`\# 标题`,
      String.raw`正文 \[literal\] 与 \path\to\card`,
      String.raw`行内 \<div class="ok"\>正文\</div\>`,
      String.raw`状态：\{\{user\}\}`,
      String.raw`\[站点\](https://example.invalid)`,
      String.raw`\| 甲 \| 乙 \|`,
    ].join('\n')
    writeFileSync(scriptSource, scriptText, 'utf8')
    execFileSync(process.execPath, [deescapePath, scriptSource], { encoding: 'utf8' })
    const converted = readFileSync(scriptSource, 'utf8')
    assert.match(converted, /^# 标题/m)
    assert.ok(converted.includes(String.raw`正文 \[literal\] 与 \path\to\card`))
    assert.match(converted, /行内 <div class="ok">正文<\/div>/)
    assert.match(converted, /状态：\{\{user\}\}/)
    assert.match(converted, /^\[站点\]\(https:\/\/example\.invalid\)$/m)
    assert.match(converted, /^\| 甲 \| 乙 \|$/m)
  }

  {
    const h=await createHarness(modulePath,scratch)
    const source={spec:'chara_card_v2',spec_version:'2.0',data:{name:'异模型卡',description:'三只蓝瓶，铜灯熄灭后才能开门。',personality:'沉静',scenario:'庭院',first_mes:'铜灯仍亮着。',mes_example:''}}
    writeFileSync(join(scratch,'native-worker.json'),JSON.stringify(source),'utf8')
    const models=h.fetchRoutes.find(r=>r.path==='/api/roleplay/models')
    const configured=await models.fetch(new Request('https://fixture.test/api/roleplay/models',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:h.session.id,scope:'session',settings:{allMain:false,routes:{'card-import':{provider:'fixture',model:'reader'}}}})}))
    assert.equal(configured.status,200)
    let spawns=0
    h.ctx.subagents.start=async(provider,request)=>{
      spawns++;assert.equal(provider,'spawn');assert.equal(request.agentOptions.model,'reader')
      for(const word of ['核心设定','剧情指引','文风特化','世界书','人物知情边界'])assert.ok(request.prompt[0].text.includes(word),`native import worker must receive ${word}`)
      const child={id:'reader-child',header:{agentPreset:'roleplay',cwd:scratch,parentSession:h.session.id},events:[{seq:0,type:'subagent/descriptor',data:{version:3,mode:'one-shot',provider:'spawn',label:request.label}}],surface:{nodes:[]}}
      h.sessions.set(child.id,child)
      const exec={agent:{session:child,options:{...request.agentOptions,subagentDepth:1}},signal:request.signal}
      const result=(async()=>{
        const call=(name,args)=>h.tools.get(name).execute(args,exec)
        const begin=await call('rp_card_import_begin',{source_file:'native-worker.json'})
        assert.equal(begin.ok,true)
        let cursor=1
        while(cursor!==null)cursor=(await call('rp_card_import_chunk',{import_id:begin.importId,cursor,max_lines:300})).nextCursor
        assert.equal((await call('rp_card_import_stage',{import_id:begin.importId,use_suggested:true})).ok,true)
        assert.equal((await call('rp_card_import_finalize',{import_id:begin.importId,expected_sha256:begin.normalizedSha256})).ok,true)
        return {stopReason:'completed',output:[{type:'text',text:'完整读卡完成'}]}
      })()
      return {id:child.id,localAgent:exec.agent,result,async dispose(){}}
    }
    const imported=await h.execute('rp_card_import_begin',{source_file:'native-worker.json'})
    assert.equal(imported.ok,true);assert.equal(spawns,1)
    assert.equal(imported.job.status,'completed')
    assert.ok(imported.job.resourceId)
    assert.ok([...h.tables.get('cards').data.keys()].every(key=>key.startsWith(`${h.session.id}__`)),'child writes only its fixed parent branch')
    await models.fetch(new Request('https://fixture.test/api/roleplay/models',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:h.session.id,scope:'session',settings:{allMain:false,routes:{'card-export':{provider:'fixture',model:'exporter'}}}})}))
    h.ctx.subagents.start=async(provider,request)=>{
      spawns++;assert.equal(provider,'spawn');assert.equal(request.agentOptions.model,'exporter')
      for(const word of ['核心设定','剧情指引','文风特化','世界书','镜头语言','source_parts'])assert.ok(request.prompt[0].text.includes(word),`native export worker must receive ${word}`)
      const child={id:'exporter-child',header:{agentPreset:'roleplay',cwd:scratch,parentSession:h.session.id},events:[{seq:0,type:'subagent/descriptor',data:{version:3,mode:'one-shot',provider:'spawn',label:request.label}}],surface:{nodes:[]}}
      h.sessions.set(child.id,child)
      const exec={agent:{session:child,options:{...request.agentOptions,subagentDepth:1}},signal:request.signal}
      const result=(async()=>{const call=(name,args)=>h.tools.get(name).execute(args,exec),start=await call('rp_card_export_begin',{});assert.equal(start.ok,true,start.error)
        let cursor=0;while(cursor!==null)cursor=(await call('rp_card_export_chunk',{export_id:start.exportId,cursor})).nextCursor
        const done=await call('rp_card_export_finalize',{export_id:start.exportId,expected_sha256:start.sourceHash,title:'异模型导出',sections:start.sources.map(s=>({heading:s.label,source_ids:[s.id]}))});assert.equal(done.ok,true,done.error)
        return {stopReason:'completed',output:[{type:'text',text:'完整导出完成'}]}})()
      return {id:child.id,localAgent:exec.agent,result,async dispose(){}}
    }
    const exported=await h.execute('rp_card_export_begin',{})
    assert.equal(exported.ok,true);assert.equal(exported.job.status,'completed');assert.equal(spawns,2)
  }
  {
    const h=await createHarness(modulePath,scratch)
    writeLines(join(scratch,'wrong-workflow.md'),['另一张卡的完整内容'])
    const begin=await h.execute('rp_card_import_begin',{source_file:'wrong-workflow.md'})
    await readAll(h.execute,begin.importId,begin.lineCount)
    await h.execute('rp_card_import_stage',{import_id:begin.importId,assignments:[{target:'card',id:'wrong',sourceSpans:[{startLine:1,endLine:1}]}]})
    const workflow=[...h.tables.get('branch').data.entries()].find(([k])=>k.startsWith('tavern_cardjob__'))
    workflow[1].source.sha256='0'.repeat(64)
    const cardTable=h.tables.get('cards'),put=cardTable.put.bind(cardTable);let writes=0
    cardTable.put=async(...args)=>{writes++;return put(...args)}
    const result=await h.execute('rp_card_import_finalize',{import_id:begin.importId,expected_sha256:begin.normalizedSha256})
    assert.equal(result.ok,false)
    assert.equal(writes,0,'mismatched task must not begin activation writes even if rollback is available')
    assert.equal(h.tables.get('cards').data.has(`${h.session.id}__wrong`),false,'workflow source mismatch must reject before activation writes')
  }
  {
    const h=await createHarness(modulePath,scratch)
    const chunk=(kind,bytes)=>{const body=Buffer.concat([Buffer.from(kind),bytes]),size=Buffer.alloc(4),crc=Buffer.alloc(4);size.writeUInt32BE(bytes.length);crc.writeUInt32BE(pngCrc(body));return Buffer.concat([size,body,crc])}
    const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(1,0);ihdr.writeUInt32BE(1,4);ihdr[8]=8;ihdr[9]=6
    const card={name:'PNG预览角色',description:'药柜里保留三只蓝瓶。',first_mes:'窗边的灯亮了。'}
    const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(Buffer.alloc(5))),chunk('tEXt',Buffer.from('chara\0'+Buffer.from(JSON.stringify(card)).toString('base64'))),chunk('IEND',Buffer.alloc(0))])
    writeFileSync(join(scratch,'preview.png'),png)
    const begin=await h.execute('rp_card_import_begin',{source_file:'preview.png'})
    const legacyRecordKey=`${h.session.id}__import-${begin.importId}`
    const legacyRecord=h.tables.get('branch').get(legacyRecordKey)
    const oldProjection=projectTavernCard(decodeTavernCard(png,'.png'))
    const oldLines=oldProjection.text.split('\n')
    if(oldProjection.text.endsWith('\n'))oldLines.pop()
    const oldStarts=[];let oldOffset=0
    for(const line of oldLines){oldStarts.push(oldOffset);oldOffset+=line.length+1}
    const oldHash=createHash('sha256').update(oldProjection.text).digest('hex')
    Object.assign(legacyRecord,{schemaVersion:4,normalizer:'tavern-fields-v1',normalizedSource:oldProjection.text,
      lines:oldLines,lineStarts:oldStarts,lineCount:oldLines.length,normalizedChars:oldProjection.text.length,
      normalizedSha256:oldHash,readRanges:[],nextReadCursor:1,reviewComplete:false,assignments:[]})
    await h.tables.get('branch').put(legacyRecordKey,legacyRecord)
    await readAll(h.execute,begin.importId,oldLines.length)
    assert.equal((await h.execute('rp_card_import_stage',{import_id:begin.importId,use_suggested:true})).ok,true)
    assert.equal((await h.execute('rp_card_import_finalize',{import_id:begin.importId,expected_sha256:oldHash})).ok,true)
    const job=[...h.tables.get('branch').data.entries()].find(([key])=>key.startsWith('tavern_cardjob__'))[1]
    const detail=await h.fetchRoutes.find(r=>r.path==='/api/roleplay/resource').fetch(new Request(`https://fixture.test/api/roleplay/resource?sessionId=${h.session.id}&resourceId=${job.resourceId}`))
    assert.match((await detail.json()).text,/PNG预览角色/,'PNG resource view must expose readable settings rather than a blank preview')
    const avatarRoute=h.fetchRoutes.find(r=>r.path==='/api/roleplay/card-avatar')
    const avatarFor=id=>avatarRoute.fetch(new Request(`https://fixture.test/api/roleplay/card-avatar?sessionId=${id}`))
    assert.equal((await avatarFor('missing-session')).status,404,'unknown session must not expose an avatar')
    h.sessions.set('avatar-empty',{id:'avatar-empty',header:{agentPreset:'roleplay',cwd:scratch},log:[],seq:0,surface:{nodes:[]}})
    assert.equal((await avatarFor('avatar-empty')).status,404,'a roleplay session without an imported card has no avatar')
    const rootAvatar=await avatarFor(h.session.id)
    assert.equal(rootAvatar.status,200)
    assert.equal(rootAvatar.headers.get('content-type'),'image/png')
    assert.equal(rootAvatar.headers.get('cache-control'),'private, no-store')
    assert.equal(rootAvatar.headers.get('x-content-type-options'),'nosniff')
    assert.match(rootAvatar.headers.get('etag') ?? '',/^"[a-f0-9]{64}"$/)
    const rootBytes=Buffer.from(await rootAvatar.arrayBuffer())
    let parentId=h.session.id
    for(const childId of ['avatar-child','avatar-grandchild']){
      h.sessions.set(childId,{id:childId,header:{agentPreset:'roleplay',cwd:scratch,parentSession:parentId,seedLength:0},log:[],seq:0,surface:{nodes:[]}})
      const inherited=await avatarFor(childId)
      assert.equal(inherited.status,200,'inherited avatar resolves the original source record through multiple forks')
      assert.deepEqual(Buffer.from(await inherited.arrayBuffer()),rootBytes)
      assert.equal(h.tables.get('branch').get(`${childId}__import-active`).sourceRecordSessionId,h.session.id)
      assert.equal(h.tables.get('branch').get(`${childId}__import-${begin.importId}`),undefined,'forks do not duplicate archived card bytes')
      parentId=childId
    }
    await h.tables.get('branch').put(`${parentId}__import-active`,{importId:begin.importId,sourceSessionId:h.session.id})
    const legacyAvatar=await avatarFor(parentId)
    assert.equal(legacyAvatar.status,200,'legacy sourceSessionId pointers remain readable')
    assert.deepEqual(Buffer.from(await legacyAvatar.arrayBuffer()),rootBytes)
    const pointer=h.tables.get('branch').get(`${h.session.id}__import-active`)
    const sourceSessionId=pointer.sourceRecordSessionId ?? pointer.sourceSessionId ?? h.session.id
    const recordKey=`${sourceSessionId}__import-${begin.importId}`
    const record=h.tables.get('branch').get(recordKey)
    const originalRecord=structuredClone(record)
    try {
      record.sourceEnvelope.extension='.jpg'
      assert.equal((await avatarFor(h.session.id)).status,404,'non-PNG source envelopes must not serve an avatar')
      record.sourceEnvelope.extension='.png'
      record.sourceEnvelope.base64='%%%'
      assert.equal((await avatarFor(h.session.id)).status,400,'corrupt source envelope bytes must fail validation')
    } finally {
      await h.tables.get('branch').put(recordKey,originalRecord)
    }
    assert.equal((await avatarFor(h.session.id)).status,200,'avatar source record is restored after corruption checks')
  }
  {
    const h=await createHarness(modulePath,scratch)
    const lines=['蒸汽与魔法共存；龙族掌握元素魔法。','深渊是侵蚀现实的灾难，其血红纹路会蔓延。','静海王国的贵族各自为政，首都受煤烟污染。','路线 A：若建立信任，可以联合诸族。','路线 C：若防线崩溃，世界可能毁灭；尚未发生。','写作示例：铜灯在雾中摇晃，齿轮声淹没了脚步。']
    writeLines(join(scratch,'setting-columns.md'),lines)
    const begin=await h.execute('rp_card_import_begin',{source_file:'setting-columns.md'})
    await readAll(h.execute,begin.importId,begin.lineCount)
    const stage=await h.execute('rp_card_import_stage',{import_id:begin.importId,assignments:[
      {target:'core-setting',sourceSpans:[{startLine:1,endLine:2}]},
      {target:'worldbook',id:'kingdom',name:'静海王国',keywords:['静海王国'],sourceSpans:[{startLine:3,endLine:3}]},
      {target:'plot-guidance',sourceSpans:[{startLine:4,endLine:5}]},
      {target:'rule-style',sourceSpans:[{startLine:6,endLine:6}]}
    ]})
    assert.equal(stage.ok,true,stage.error)
    const activated=await h.execute('rp_card_import_finalize',{import_id:begin.importId,expected_sha256:begin.normalizedSha256})
    assert.equal(activated.ok,true,activated.error)
    const rules=h.tables.get('rules').get(`${h.session.id}__spec`)
    assert.ok(rules.core.includes(lines[1]));assert.ok(rules.plot.includes(lines[4]));assert.ok(rules.style.includes(lines[5]))
    assert.equal(rules.schemaVersion,1);assert.equal(rules.sources.core.length,1);assert.equal(rules.sources.plot.length,1)
    const prompt=h.promptSections.get('roleplay:rules').text({agent:{session:h.session}})
    assert.ok(prompt.includes(lines[1]));assert.ok(prompt.includes(lines[4]));assert.ok(!prompt.includes(lines[5]),'default system style excludes card examples without deleting stored text')
    assert.match(prompt,/未发生|尚未发生/)
    const presets=h.fetchRoutes.find(r=>r.path==='/api/roleplay/presets')
    const selected=await presets.fetch(new Request('https://fixture.test/api/roleplay/presets',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({sessionId:h.session.id,action:'select',scope:'conversation',expectedRevision:0,selection:{presetId:'system-velvet-blade',mode:'blend'}})}))
    assert.equal(selected.status,200)
    const blended=h.promptSections.get('roleplay:rules').text({agent:{session:h.session}})
    assert.ok(blended.includes(lines[5]));assert.match(blended,/示例.*不是|示例.*不代表/)
    assert.ok(!prompt.includes(lines[2]),'passive lore is not permanent background')
    const found=await h.execute('rp_worldbook_search',{query:'静海王国'})
    assert.equal(found.ok,true);assert.match(found.text,/贵族各自为政/);assert.equal(found.branchId,h.session.id)
    assert.equal((await h.execute('rp_worldbook_search',{query:'没有相关条目'})).count,0)
    assert.equal((await h.execute('rp_worldbook_search',{query:''})).ok,false)
    const exp=await h.execute('rp_card_export_begin',{})
    let cursor=0;while(cursor!==null)cursor=(await h.execute('rp_card_export_chunk',{export_id:exp.exportId,cursor})).nextCursor
    const exported=await h.execute('rp_card_export_finalize',{export_id:exp.exportId,expected_sha256:exp.sourceHash,title:'核心设定与路线',sections:exp.sources.map(u=>({heading:u.label,source_ids:[u.id]}))})
    assert.equal(exported.ok,true,exported.error)
    const md=readFileSync(exported.file,'utf8');for(const line of lines)assert.ok(md.includes(line),'all setting and example details survive export')
     const getState=()=>h.fetchRoutes.find(r=>r.path==='/api/roleplay/state').fetch(new Request(`https://fixture.test/api/roleplay/state?sessionId=${h.session.id}`)).then(r=>r.json())
     const state=await getState(),save=h.fetchRoutes.find(r=>r.path==='/api/roleplay/set')
    const edit={sessionId:h.session.id,kind:'rules',core:'当前编辑：三个月亮。\n镜头语言：从窗外雨滴推进到人物手部。',plot:'当前路线：先公开证据。',expectedRevision:state.recordVersions.rules}
    const request=body=>new Request('https://fixture.test/api/roleplay/set',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})
    assert.equal((await save.fetch(request(edit))).status,200)
    assert.equal((await save.fetch(request(edit))).status,409,'stale editor cannot overwrite latest settings')
    const edited=h.tables.get('rules').get(`${h.session.id}__spec`)
    assert.equal(edited.core,edit.core);assert.equal(edited.plot,edit.plot);assert.equal(edited.style,rules.style)
    assert.deepEqual(edited.sources,rules.sources,'user edits preserve original provenance')
    assert.equal(edited.verified,false);assert.equal(edited.editedFrom.source,'user-edit')
    const nextExport=await h.execute('rp_card_export_begin',{})
    cursor=0;while(cursor!==null)cursor=(await h.execute('rp_card_export_chunk',{export_id:nextExport.exportId,cursor})).nextCursor
    const coreUnit=nextExport.sources.find(s=>s.label==='rules: core')
    const sourceView=await h.execute('rp_card_export_chunk',{export_id:nextExport.exportId,source_id:coreUnit.id,start_line:1})
    assert.equal(sourceView.lineCount,2);assert.match(sourceView.text,/2: 镜头语言/)
    const organization=nextExport.sources.filter(s=>s.id!==coreUnit.id).map(s=>({heading:s.label,source_ids:[s.id]}))
    organization.push({heading:'核心设定',source_parts:[{source_id:coreUnit.id,start_line:1,end_line:1}]},{heading:'叙事规则',source_parts:[{source_id:coreUnit.id,start_line:2,end_line:2}]})
    const latest=await h.execute('rp_card_export_finalize',{export_id:nextExport.exportId,expected_sha256:nextExport.sourceHash,title:'最新创作设定',sections:organization})
    assert.equal(latest.ok,true,latest.error);assert.match(readFileSync(latest.file,'utf8'),/## 叙事规则\n\n镜头语言：从窗外雨滴推进到人物手部。/)
  }
  {
    // Mechanical fixture mapping tests storage fidelity; the production model
    // must perform its own semantic classification from ordinary player input.
    const h=await createHarness(modulePath,scratch)
    const fixture=readFileSync(new URL('./fixtures/steam-tide-full-card.md',import.meta.url),'utf8').replace(/\r\n/g,'\n').trimEnd()
    const lines=fixture.split('\n');writeLines(join(scratch,'full-card.md'),lines)
    const begin=await h.execute('rp_card_import_begin',{source_file:'full-card.md'})
    await readAll(h.execute,begin.importId,begin.lineCount)
    const starts=lines.flatMap((line,i)=>line.startsWith('## ')?[i]:[])
    const assignments=[],add=(target,start,end,extra={})=>{if(start<=end)assignments.push({target,sourceSpans:[{startLine:start+1,endLine:end+1}],...extra})}
    add('archive-only',0,starts[0]-1)
    for(let i=0;i<starts.length;i++){
      const start=starts[i],end=(starts[i+1]??lines.length)-1
      if([2,3,4].includes(i)){
        const children=lines.flatMap((line,n)=>n>start&&n<=end&&line.startsWith('### ')?[n]:[])
        add('archive-only',start,children[0]-1)
        children.forEach((n,j)=>add(i===4?(j===3?'core-setting':'card'):'worldbook',n,(children[j+1]??end+1)-1,{id:`fixture-${i}-${j}`,name:lines[n].slice(4).split('｜')[0],keywords:[lines[n].slice(4).split('｜')[0]],kind:i===4?'npc':'term',...(i===4&&j===3?{merge_group:'core-setting'}:{})}))
      }else if(i===10){
        const narrative=lines.indexOf('### 叙事规则',start),reply=lines.indexOf('### 回复规则',start)
        assert.ok(narrative>start&&reply>narrative)
        add('archive-only',start,narrative-1);add('rule-narrative',narrative,reply-1,{merge_group:'rule-narrative'});add('rule-reply',reply,end)
      }else if(i===11){
        const json=lines.indexOf('```json',start),css=lines.indexOf('```css',start)
        const jsonEnd=lines.indexOf('```',json+1),cssEnd=lines.indexOf('```',css+1)
        add('archive-only',start,json-1);add('beauty-regex',json,jsonEnd)
        add('archive-only',jsonEnd+1,css);add('beauty-css',css+1,cssEnd-1);add('archive-only',cssEnd,end)
      }else{
        const target={0:'core-setting',1:'core-setting',5:'plot-guidance',6:'rule-narrative',7:'rule-style',8:'opening',9:'status',10:'rule-reply'}[i]
        assert.ok(target,`unmapped fixture module ${i}`);add(target,start,end,{merge_group:target})
      }
    }
    const staged=await h.execute('rp_card_import_stage',{import_id:begin.importId,assignments})
    assert.equal(staged.ok,true,staged.error)
    const active=await h.execute('rp_card_import_finalize',{import_id:begin.importId,expected_sha256:begin.normalizedSha256})
    assert.equal(active.ok,true,active.error)
    assert.equal(h.tables.get('cards').data.size,3)
    assert.equal(h.tables.get('worldbook').data.size,8)
    const rules=h.tables.get('rules').get(`${h.session.id}__spec`)
    assert.match(rules.core,/逆潮/);assert.match(rules.plot,/尚未发生|未发生/);assert.match(rules.style,/盐灯修理铺/)
    assert.equal(rules.beauty.regexRules.length,3)
    const expectations=JSON.parse(readFileSync(new URL('./fixtures/steam-tide-full-card.expectations.json',import.meta.url),'utf8'))
    for(const example of expectations.regexSamples){const rule=rules.beauty.regexRules[example.rule];assert.equal(example.source.replace(new RegExp(rule.match,'gm'),rule.replace),example.expected)}
    const exp=await h.execute('rp_card_export_begin',{})
    let cursor=0;while(cursor!==null)cursor=(await h.execute('rp_card_export_chunk',{export_id:exp.exportId,cursor})).nextCursor
    const result=await h.execute('rp_card_export_finalize',{export_id:exp.exportId,expected_sha256:exp.sourceHash,title:'雾港全量导出',sections:exp.sources.map(s=>({heading:s.label,source_ids:[s.id]}))})
    assert.equal(result.ok,true,result.error)
    const out=readFileSync(result.file,'utf8')
    for(const line of lines.filter(line=>line.trim()&&!['```','```json','```css'].includes(line)))assert.ok(out.includes(line)||line.trim().startsWith('{"match"'),`full source line retained: ${line.slice(0,50)}`)
  }
  {
    const h=await createHarness(modulePath,scratch)
    writeLines(join(scratch,'misclassified-status.md'),['时间每回合加5分钟。','<style>.author-status{color:blue}</style>','<section class="author-status"><span>21:00</span></section>'])
    const begin=await h.execute('rp_card_import_begin',{source_file:'misclassified-status.md'})
    await readAll(h.execute,begin.importId,begin.lineCount)
    await h.execute('rp_card_import_stage',{import_id:begin.importId,assignments:[{target:'status',sourceSpans:[{startLine:1,endLine:1}]},{target:'beauty-css',sourceSpans:[{startLine:2,endLine:3}]}]})
    const invalid=await h.execute('rp_card_import_finalize',{import_id:begin.importId,expected_sha256:begin.normalizedSha256})
    assert.equal(invalid.ok,false,'full coverage cannot authorize HTML mistaken for a stylesheet')
    assert.match(invalid.error,/HTML.*status|HTML.*状态栏/)
    assert.equal(h.tables.get('status').get(`${h.session.id}__spec`),undefined,'invalid classification does not activate')
    await h.execute('rp_card_import_stage',{import_id:begin.importId,replace_all:true,assignments:[{target:'status',sourceSpans:[{startLine:1,endLine:3}]}]})
    assert.equal((await h.execute('rp_card_import_finalize',{import_id:begin.importId,expected_sha256:begin.normalizedSha256})).ok,true)
    assert.match(h.tables.get('status').get(`${h.session.id}__spec`).templateHtml,/class="author-status"/)
  }
  console.log('roleplay card import tests: ok')
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
