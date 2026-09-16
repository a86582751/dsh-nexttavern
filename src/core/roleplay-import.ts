import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { keyOf, safeId, sha256, stableJson, cloneRecord, recordSha256, deescapeMarkdown, stableImportId } from './roleplay-data.js'
import { lastSeq, eventsOf } from './roleplay-context.js'
import { readCardSource, decodeTavernCard, projectTavernCard, fenceCardContent } from './tavern-card.js'
import { registerCardExport } from './card-export.js'
import { cardCodeBlocks, statusTemplateDiagnostics } from '../status-template.js'
import { isInlinePending } from './tavern-tasks.js'
import type { CardImportDependencies, ImportRecord, ImportPointer, ImportAssignment, SourceSpan, SourceDescriptor, ImportSession, ImportExec, ImportTable, ImportWrite, MaterialPiece, RulesRecord, MaterialRecord } from './roleplay-import-types.js'
import type { ExportMaterial } from './card-export-projection.js'

export function importActiveKey(sessionId: string) { return keyOf(sessionId, 'import-active') }

const errorMessage = (error: unknown) => (error as { message?: unknown } | null)?.message ?? error

export function registerRoleplayImports(deps: CardImportDependencies) {
  const { ctx, T, CARD_CLASSIFICATION_GUIDE, activeCardWorkflow, assertCardWorkflow, beginCardWorkflow, resumeCardWorkflows, cardWorkflowKey, libraryFor, resourceName, completeCardWorkflow, ensureBranch, RULE_TEXT_FIELDS, ensureState, simpleTool, sessionOf, RULE_IMPORT_FIELDS, archiveImported } = deps
  const importRecordKey = (sessionId: string, importId: unknown) => keyOf(sessionId, `import-${safeId(importId)}`)
  registerCardExport(ctx, {simpleTool, sessionOf, table:T.branch, lock:(...args)=>withImportLock(...args),classificationGuide:CARD_CLASSIFICATION_GUIDE,
    workflowOf:session=>{const job=activeCardWorkflow(session);return job?.kind==='card-export'?job.id:undefined},
    workflowGeneration:session=>activeCardWorkflow(session)?.generation,
    assertWorkflow:assertCardWorkflow,
    beforeBegin:async(session: ImportSession,exec: ImportExec)=>{
      if(Number(exec.agent?.options?.subagentDepth)>0||eventsOf(exec.agent?.session).some(e=>e.type==='subagent/descriptor'))return null
      const job=await beginCardWorkflow(session,'card-export',null,exec.agent)
      if(job.execution==='spawn') {
        try{await resumeCardWorkflows(session,exec.agent,exec.signal)}catch(error){if(!isInlinePending(error))throw error}
        return {ok:true,job:T.branch.get(cardWorkflowKey(job.id)),pending:true}
      }
      return null
    },
    onCompleted:async(session,record,markdown)=>{
      assertCardWorkflow(session,record)
      const resource=await libraryFor(session).archive({name:resourceName(record.title??'角色卡'),type:'text/markdown',bytes:Buffer.from(markdown,'utf8'),source:{sessionId:session.id,kind:'card-export',exportId:record.exportId}})
      assertCardWorkflow(session,record)
      await completeCardWorkflow(session,record,{exportId:record.exportId,file:record.file,resourceId:resource.id})
      return resource
    },
    collect:async session=>{
      await ensureBranch(session)
      const prefix=`${session.id}__`, material: ExportMaterial[]=[]
      for(const [tableName,table,field] of [['cards',T.cards,'content'],['worldbook',T.worldbook,'content']] as const) {
        for(const [key,record] of [...table.entries()].sort(([a],[b])=>a.localeCompare(b,'en'))) {
          if(!key.startsWith(prefix)||!record)continue
          const {content,...metadata}=record
          const source={table:tableName,key,sha256:sha256(stableJson(record))}
          material.push({label:`${tableName}: ${record.name??record.id}`,text:String(record[field]??''),source})
          material.push({label:`${tableName} 条目属性与来源: ${record.id}`,text:'```json\n'+stableJson(metadata)+'\n```',source})
        }
      }
      for(const [tableName,table,id] of [['rules',T.rules,'spec'],['status',T.status,'spec'],['opening',T.opening,'scene']] as const) {
        const record=table.get(keyOf(session.id,id)) as RulesRecord | undefined
        if(!record)continue
        const source={table:tableName,key:keyOf(session.id,id),sha256:sha256(stableJson(record))}, metadata={...record}
        for(const field of (tableName==='rules'?RULE_TEXT_FIELDS:['text'])){
          if(record[field])material.push({label:`${tableName}: ${field}`,text:String(record[field]),source})
          delete metadata[field]
        }
        if(metadata.beauty){
          for(const field of ['css','js'] as const) if(metadata.beauty[field])material.push({label:`正文美化 ${field}`,text:'```'+field+'\n'+metadata.beauty[field]+'\n```',source})
          const {css,js,...beauty}=metadata.beauty; metadata.beauty=beauty
        }
        material.push({label:`${tableName} 属性与来源`,text:'```json\n'+stableJson(metadata)+'\n```',source})
      }
      const pointer=T.branch.get(importActiveKey(session.id)) as ImportPointer | undefined
      const original=(pointer?.importId?T.branch.get(importRecordKey(pointer.sourceRecordSessionId??session.id,pointer.importId)):null) as ImportRecord | null
      const structuredOriginals=new Map(original?.sourceEnvelope?[[original.importId,original]]:[])
      // Export referenced appendices from every merged import, including an
      // inherited source record. Do not silently drop unclassified MD text.
      for(const ref of T.rules.get(keyOf(session.id,'spec'))?.sources?.archiveOnly??[]){
        const candidates=([...T.branch.entries()] as [string, ImportRecord][]).filter(([,r])=>r?.importId===ref.importId&&r?.normalizedSha256===ref.normalizedSourceSha256&&typeof r.normalizedSource==='string')
        const record=candidates[0]?.[1]
        if(!record)throw new Error('附加资料来源缺失；请恢复原始导入记录后重试导出')
        assertImportRecordIntegrity(record)
        const text=spanText(record,normalizeSourceSpans(ref.sourceSpans,record.lineCount))
        if(sha256(text)!==ref.sourceSha256)throw new Error('附加资料来源哈希变化，不能完整导出')
        // Structured originals are represented by current fields plus extras,
        // so the old raw document cannot masquerade as current edited content.
        if(record.sourceEnvelope){structuredOriginals.set(record.importId,record);if(text.startsWith('## 完整结构化原件（只归档，不注入剧情）'))continue}
        if(text.trim())material.push({label:`附加资料（原文保留）: ${ref.name??ref.importId}`,text,source:ref})
      }
      for(const original of structuredOriginals.values()){
        const decoded=decodeTavernCard(Buffer.from(original.sourceEnvelope!.base64,'base64'),original.sourceEnvelope!.extension)
        const extras={...decoded.data}
        for(const field of ['name','description','personality','scenario','first_mes','mes_example','system_prompt','post_history_instructions','character_book'])delete extras[field]
        if(decoded.data.character_book){const {entries,...bookSettings}=decoded.data.character_book as {entries?: Record<string, MaterialRecord>};extras.character_book_settings=bookSettings;extras.character_book_entry_metadata=Object.values(entries??{}).map(({content,...metadata})=>metadata)}
        if(decoded.document!==decoded.data){const {data,...wrapper}=decoded.document;extras.wrapper_fields=wrapper}
        material.push({label:'原件附加字段（未映射资料；不覆盖当前编辑）',text:'```json\n'+stableJson(extras)+'\n```',source:{importId:original.importId,rawSha256:original.rawSha256}})
      }
      return material
    }})
  const IMPORT_NORMALIZER = 'utf8-lf+anydoc-deescape-v2'
  const IMPORT_SOURCE_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.png', '.json'])
  // Hard limits protect the storage domain and the synchronous line/span
  // coverage pass from a malformed or adversarial tool payload.  These are
  // deliberately generous for long-form RP cards and reject rather than
  // silently truncate author material.
  const IMPORT_LIMITS = Object.freeze({
    maxBytes: 20_000_000,
    maxChars: 5_000_000,
    maxLines: 1_000_000,
    maxAssignments: 4096,
    maxSpansPerAssignment: 256,
    maxTotalSpans: 16_384,
    maxNameChars: 512,
    maxMetadataChars: 16_384,
    maxListItems: 256,
    maxListItemChars: 512,
    maxTotalMetadataChars: 2_000_000,
    maxTotalListItems: 16_384,
    maxReferencedChars: 40_000_000,
  })
  const importTableByName: Record<string, ImportTable> = {
    cards: T.cards,
    worldbook: T.worldbook,
    rules: T.rules,
    status: T.status,
    opening: T.opening,
  }

  const withImportLock = async <T,>(sessionId: string, _importId: unknown, task: () => T | PromiseLike<T>): Promise<T> => {
    const state = ensureState(sessionId)
    // All imports of one Session mutate the same material tables and active
    // pointer.  Locking by importId permits two different finalizes to
    // interleave and lets either rollback erase the other's writes.
    const lockKey = '__session__'
    const previous = state.importPending.get(lockKey) ?? Promise.resolve()
    const current = previous.catch(() => undefined).then(task)
    state.importPending.set(lockKey, current)
    try {
      return await current
    } finally {
      if (state.importPending.get(lockKey) === current) state.importPending.delete(lockKey)
    }
  }

  // Non-prompt read APIs cannot hold the material lock while composing their
  // response, but they must at least wait for an in-flight activation to leave
  // the committing state. Phase A itself acquires withImportLock and therefore
  // must not call this helper from inside that critical section.
  const awaitImportBarrier = async (sessionId: string) => {
    const pending = ensureState(sessionId).importPending.get('__session__')
    if (pending) await pending
  }

  const resolveImportSource = (session: ImportSession, requestedPath: unknown) => {
    const cwd = String(session?.header?.cwd ?? '').trim()
    if (!cwd) throw new Error('当前会话缺少 cwd，无法验证角色卡来源路径')
    const source = readCardSource(cwd, requestedPath)
    if (!IMPORT_SOURCE_EXTENSIONS.has(source.extension)) throw new Error('source_file 必须是 .md/.markdown/.txt 或酒馆 .png/.json 文件')
    return source
  }

  const computeLineStarts = (normalizedSource: string) => {
    const starts = [0]
    for (let index = 0; index < normalizedSource.length; index++) {
      if (normalizedSource.charCodeAt(index) === 10 && index + 1 < normalizedSource.length) starts.push(index + 1)
    }
    return starts
  }

  const lineStartsOf = (record: ImportRecord) => {
    if (Array.isArray(record.lineStarts) && record.lineStarts.length === record.lineCount) return record.lineStarts
    return computeLineStarts(String(record.normalizedSource ?? ''))
  }

  const assertImportRecordIntegrity = (record: ImportRecord) => {
    if (!record || typeof record !== 'object') throw new Error('导入记录损坏或不存在')
    const structured = record.schemaVersion === 4 && record.normalizer === 'tavern-fields-v1'
    if (!structured && (record.schemaVersion !== 3 || record.normalizer !== IMPORT_NORMALIZER)) {
      throw new Error('导入记录版本或规范化器不匹配；请从不可变 raw source 重新 begin')
    }
    const normalizedSource = record.normalizedSource
    if (typeof normalizedSource !== 'string' || !normalizedSource.length) throw new Error('导入记录缺少规范化原文')
    if (normalizedSource.length > IMPORT_LIMITS.maxChars) throw new Error('导入原文超过字符上限')
    const expectedLines = normalizedSource.split('\n')
    if (normalizedSource.endsWith('\n')) expectedLines.pop()
    const expectedLineCount = expectedLines.length
    if (!Number.isSafeInteger(record.lineCount) || record.lineCount !== expectedLineCount || record.lineCount < 1 || record.lineCount > IMPORT_LIMITS.maxLines) {
      throw new Error('导入记录行数元数据不一致')
    }
    if (sha256(normalizedSource) !== String(record.normalizedSha256 ?? '')) throw new Error('归档原文 SHA-256 校验失败')
    if (!structured && record.rawSource !== undefined && typeof record.rawSource === 'string' && record.rawSha256 !== undefined
      && sha256(record.rawSource) !== String(record.rawSha256)) throw new Error('原始来源 SHA-256 校验失败')
    if (typeof record.rawSource !== 'string'
      || Number(record.rawChars) !== record.rawSource.length
      || (!structured && Number(record.sourceBytes) !== Buffer.byteLength(record.rawSource, 'utf8'))
      || Number(record.normalizedChars) !== normalizedSource.length) {
      throw new Error('导入记录字符数或字节数元数据不一致')
    }
    if (structured) {
      const envelope = record.sourceEnvelope
      if (envelope?.schemaVersion !== 1 || typeof envelope.base64 !== 'string' || envelope.base64.length > 27_000_000) throw new Error('结构化原件归档无效')
      const bytes = Buffer.from(envelope.base64, 'base64')
      if (bytes.toString('base64') !== envelope.base64 || bytes.length !== record.sourceBytes || sha256(bytes) !== record.rawSha256) throw new Error('结构化原件哈希或大小校验失败')
      const decoded = decodeTavernCard(bytes, envelope.extension)
      if(decoded.format!==envelope.format||decoded.sourceSha256!==envelope.sourceSha256||record.rawSha256!==envelope.sourceSha256)throw new Error('结构化原件格式或来源证据不一致')
      if (JSON.stringify(decoded.document, null, 2) !== record.rawSource || projectTavernCard(decoded).text !== normalizedSource) throw new Error('结构化原件与投影不一致')
    }
    const expectedStarts = computeLineStarts(normalizedSource)
    if (!Array.isArray(record.lineStarts) || record.lineStarts.length !== expectedStarts.length
      || record.lineStarts.some((value, index) => Number(value) !== expectedStarts[index])) {
      throw new Error('导入记录行起始偏移元数据不一致')
    }
    if (!Array.isArray(record.lines) || record.lines.length !== expectedLineCount) throw new Error('导入记录行内容元数据不一致')
    if (record.lines.some((line, index) => line !== expectedLines[index])) throw new Error('导入记录行内容与规范化原文不一致')
    return true
  }

  const assertAssignmentBudget = (assignments: readonly ImportAssignment[]) => {
    if (!Array.isArray(assignments) || assignments.length > IMPORT_LIMITS.maxAssignments) {
      throw new Error(`assignment 数量超过上限 ${IMPORT_LIMITS.maxAssignments}`)
    }
    let totalSpans = 0
    let totalMetadataChars = 0
    let totalListItems = 0
    for (const [index, assignment] of assignments.entries()) {
      if (!assignment || typeof assignment !== 'object') throw new Error(`assignment ${index + 1} 不是对象`)
      const spans = assignment.sourceSpans
      if (!Array.isArray(spans) || spans.length === 0 || spans.length > IMPORT_LIMITS.maxSpansPerAssignment) {
        throw new Error(`assignment ${index + 1} 的 sourceSpans 数量无效（上限 ${IMPORT_LIMITS.maxSpansPerAssignment}）`)
      }
      totalSpans += spans.length
      if (totalSpans > IMPORT_LIMITS.maxTotalSpans) throw new Error(`sourceSpans 总数超过上限 ${IMPORT_LIMITS.maxTotalSpans}`)
      for (const field of ['id', 'name', 'kind', 'merge_group', 'reuse_reason']) {
        const limit = field === 'name' || field === 'id' || field === 'kind'
          ? IMPORT_LIMITS.maxNameChars
          : IMPORT_LIMITS.maxMetadataChars
        if (assignment[field] !== undefined && String(assignment[field]).length > limit) {
          throw new Error(`assignment ${index + 1} 的 ${field} 过长`)
        }
        totalMetadataChars += assignment[field] === undefined ? 0 : String(assignment[field]).length
      }
      for (const field of ['aliases', 'keywords', 'triggers']) {
        if (assignment[field] !== undefined) {
          if (!Array.isArray(assignment[field]) || assignment[field].length > IMPORT_LIMITS.maxListItems) {
            throw new Error(`assignment ${index + 1} 的 ${field} 数量超过上限`)
          }
          if (assignment[field].some((value) => String(value).length > IMPORT_LIMITS.maxListItemChars)) {
            throw new Error(`assignment ${index + 1} 的 ${field} 项过长`)
          }
          totalListItems += assignment[field].length
          totalMetadataChars += assignment[field].reduce((sum, value) => sum + String(value).length, 0)
        }
      }
      if (totalListItems > IMPORT_LIMITS.maxTotalListItems) {
        throw new Error(`assignment 列表项总数超过上限 ${IMPORT_LIMITS.maxTotalListItems}`)
      }
      if (totalMetadataChars > IMPORT_LIMITS.maxTotalMetadataChars) {
        throw new Error(`assignment 元数据总字符数超过上限 ${IMPORT_LIMITS.maxTotalMetadataChars}`)
      }
    }
    return true
  }

  const assertReviewProof = (record: ImportRecord) => {
    if (record.reviewComplete !== true || record.nextReadCursor !== null) {
      throw new Error(`全文尚未连续审阅完成；下一块 cursor=${record.nextReadCursor}`)
    }
    const ranges = Array.isArray(record.readRanges) ? record.readRanges : []
    if (!ranges.length) throw new Error('全文审阅证明缺失')
    if (ranges.length > Math.ceil(record.lineCount / 20)) throw new Error('全文审阅证明范围数量异常')
    let next = 1
    for (const range of ranges) {
      const start = Number(range?.startLine)
      const end = Number(range?.endLine)
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
        || start !== next || end < start || end > record.lineCount
        || String(range?.sourceSha256 ?? '') !== String(record.normalizedSha256)) {
        throw new Error('全文审阅证明不连续或来源哈希不一致')
      }
      next = end + 1
    }
    if (next !== record.lineCount + 1) throw new Error('全文审阅证明未覆盖至文件末尾')
    return true
  }
  const normalizeSourceSpan = (span: SourceSpan, lineCount: number) => {
    const startLine = Number(span?.startLine)
    const endLine = Number(span?.endLine)
    if (!Number.isSafeInteger(startLine) || !Number.isSafeInteger(endLine) || startLine < 1 || endLine < startLine || endLine > lineCount) {
      throw new Error(`非法 sourceSpan: ${String(span?.startLine)}-${String(span?.endLine)}（有效行号 1-${lineCount}）`)
    }
    return { startLine, endLine }
  }

  const normalizeSourceSpans = (spans: readonly SourceSpan[], lineCount: number) => {
    const normalized = (spans ?? [])
      .map((span) => normalizeSourceSpan(span, lineCount))
      .sort((left, right) => left.startLine - right.startLine || left.endLine - right.endLine)
    for (let index = 1; index < normalized.length; index++) {
      if (normalized[index]!.startLine <= normalized[index - 1]!.endLine) {
        throw new Error(`同一 assignment 内 sourceSpans 重叠：${normalized[index - 1]!.startLine}-${normalized[index - 1]!.endLine} 与 ${normalized[index]!.startLine}-${normalized[index]!.endLine}`)
      }
    }
    return normalized
  }

  const spanFragments = (record: ImportRecord, spans: readonly SourceSpan[]) => {
    const starts = lineStartsOf(record)
    return spans.map((span) => {
      const startOffset = starts[span.startLine - 1]
      const endOffset = span.endLine < record.lineCount ? starts[span.endLine] : record.normalizedSource.length
      const text = record.normalizedSource.slice(startOffset, endOffset)
      return {
        startLine: span.startLine,
        endLine: span.endLine,
        startOffset,
        endOffset,
        chars: text.length,
        sha256: sha256(text),
        text,
      }
    })
  }

  // Concatenate exact source fragments without inventing separator text. Each
  // non-final line fragment already owns its terminating LF.
  const spanText = (record: ImportRecord, spans: readonly SourceSpan[]) => spanFragments(record, spans).map((fragment) => fragment.text).join('')

  const assertReferenceBudget = (record: ImportRecord, assignments: readonly ImportAssignment[]) => {
    const starts = lineStartsOf(record)
    let referencedChars = 0
    for (const assignment of assignments) {
      for (const rawSpan of assignment.sourceSpans ?? []) {
        const span = normalizeSourceSpan(rawSpan, record.lineCount)
        const startOffset = starts[span.startLine - 1]!
        const endOffset = span.endLine < record.lineCount ? starts[span.endLine]! : record.normalizedSource.length
        referencedChars += endOffset - startOffset
        if (referencedChars > IMPORT_LIMITS.maxReferencedChars) {
          throw new Error(`sourceSpans 引用正文总量超过上限 ${IMPORT_LIMITS.maxReferencedChars} 字符（含 secondary 复用）`)
        }
      }
    }
    return referencedChars
  }

  const sourceDescriptor = (record: ImportRecord, assignment: ImportAssignment): SourceDescriptor => ({
    schemaVersion:1,
    importId: record.importId,
    target: assignment.target,
    sourceSpans: cloneRecord(assignment.sourceSpans),
    fragments: spanFragments(record, assignment.sourceSpans).map(({ text: _text, ...fragment }) => fragment),
    sourceSha256: assignment.sourceSha256,
    normalizedSourceSha256: record.normalizedSha256,
    ...(record.sourceEnvelope?{originalSourceSha256:record.rawSha256,format:record.sourceEnvelope.format}:{}),
    exactCopy: true,
    secondary: assignment.secondary === true,
    ...(assignment.reuse_reason ? { reuseReason: assignment.reuse_reason } : {}),
  })

  const rangesOf = (lines: readonly number[]) => {
    const ranges: SourceSpan[] = []
    for (const line of lines) {
      const last = ranges.at(-1)
      if (last && last.endLine + 1 === line) last.endLine = line
      else ranges.push({ startLine: line, endLine: line })
    }
    return ranges
  }

  const importCoverage = (record: ImportRecord, assignments = record.assignments ?? []) => {
    if (!record || typeof record.normalizedSource !== 'string'
      || !Number.isSafeInteger(record.lineCount)
      || record.lineCount < 1 || record.lineCount > IMPORT_LIMITS.maxLines
      || record.normalizedSource.length > IMPORT_LIMITS.maxChars) {
      throw new Error('导入记录超出覆盖率计算边界')
    }
    assertAssignmentBudget(assignments)
    // A Map<line, Set<assignment>> made deliberately overlapping spans
    // O(assignments * lines) and could freeze the single Node event loop.  A
    // difference array preserves the exact same ownership semantics in
    // O(lines + spans), with bounded memory from maxLines.
    const ownershipDelta = new Int32Array(record.lineCount + 2)
    for (const assignment of assignments) {
      if (assignment.secondary === true) continue
      for (const rawSpan of assignment.sourceSpans ?? []) {
        const span = normalizeSourceSpan(rawSpan, record.lineCount)
        ownershipDelta[span.startLine]! += 1
        ownershipDelta[span.endLine + 1]! -= 1
      }
    }
    const starts = lineStartsOf(record)
    const lineChars = (line: number) => {
      const startOffset = starts[line - 1]!
      const endOffset = line < record.lineCount ? starts[line]! : record.normalizedSource.length
      return endOffset - startOffset
    }
    const uncovered = []
    const overlaps = []
    const totalChars = record.normalizedSource.length
    let coveredChars = 0
    let ownership = 0
    for (let line = 1; line <= record.lineCount; line++) {
      ownership += ownershipDelta[line]!
      if (ownership === 0) uncovered.push(line)
      else if (ownership > 1) overlaps.push(line)
      else coveredChars += lineChars(line)
    }
    return {
      sourceLines: record.lineCount,
      coveredLines: record.lineCount - uncovered.length - overlaps.length,
      sourceChars: totalChars,
      coveredChars,
      coverage: totalChars === 0 ? 1 : coveredChars / totalChars,
      uncovered,
      overlaps,
      uncoveredRanges: rangesOf(uncovered),
      overlapRanges: rangesOf(overlaps),
    }
  }

  const assignmentIdentity = (assignment: ImportAssignment) => {
    if (assignment.target === 'card') return `card:${assignment.kind === 'user' ? 'user' : assignment.id}`
    if (assignment.target === 'worldbook') return `worldbook:${assignment.id}`
    return null
  }

  const validateAssignmentIdentities = (assignments: readonly ImportAssignment[]) => {
    const seen = new Map<string, ImportAssignment>()
    for (const assignment of assignments) {
      const identity = assignmentIdentity(assignment)
      if (!identity) continue
      const previous = seen.get(identity)
      if (!previous) {
        seen.set(identity, assignment)
        continue
      }
      const mergeGroup = String(assignment.merge_group ?? '')
      if (!mergeGroup || mergeGroup !== String(previous.merge_group ?? '')) {
        throw new Error(`重复导入目标 ${identity}；请把离散范围合并到同一 assignment.sourceSpans，或为确需合并的条目设置相同 merge_group`)
      }
    }
  }

  const parseRegexRules = (sourceText: unknown) => {
    const raw = String(sourceText ?? '').trim()
    const fenced = [...raw.matchAll(/```(?:json|javascript|js)?\s*\n([\s\S]*?)```/gi)]
      .map((match) => match[1]!.trim())
    const candidates = [...fenced, raw]
    let parsed: unknown
    let parseError: unknown
    for (const candidate of candidates) {
      try {
        parsed = JSON.parse(candidate)
        break
      } catch (error) {
        parseError = error
      }
    }
    if (parsed === undefined) {
      throw new Error(`beauty-regex 来源必须是原卡中的 JSON/JSON fenced code：${String((parseError as {message?: unknown})?.message ?? '无法解析')}`)
    }
    const wrapped = parsed as { regexRules?: unknown } | null
    const list: unknown[] = Array.isArray(parsed) ? parsed : Array.isArray(wrapped?.regexRules) ? wrapped.regexRules : [parsed]
    if (!list.length || list.length > 200) throw new Error('beauty-regex 必须包含 1-200 条规则')
    return list.map((value, index) => {
      const rule = value as { match?: unknown; replace?: unknown } | null
      const match = typeof rule?.match === 'string' ? rule.match : ''
      if (typeof rule?.replace !== 'string') throw new Error(`beauty-regex 第 ${index + 1} 条缺少字符串 replace`)
      const replace = rule.replace
      if (!match) throw new Error(`beauty-regex 第 ${index + 1} 条缺少 match`)
      if (match.length > 4096 || replace.length > 65536) throw new Error(`beauty-regex 第 ${index + 1} 条过长`)
      try {
        new RegExp(match, 'g')
      } catch (error) {
        throw new Error(`beauty-regex 第 ${index + 1} 条不是合法 JavaScript 正则：${String(errorMessage(error))}`)
      }
      return { match, replace }
    })
  }

  const verifyWrite = (write: ImportWrite) => {
    const actual = write.table.get(write.key)
    if (write.next === undefined) return actual === undefined
    return recordSha256(actual) === recordSha256(write.next)
  }

  const restoreImportTransaction = async (sessionId: string, key: string, record: ImportRecord) => {
    const transaction = record?.transaction
    if (!transaction || !Array.isArray(transaction.writes)
      || transaction.writes.length > IMPORT_LIMITS.maxAssignments * 4) {
      throw new Error('导入处于 committing/recovery-required，但缺少可恢复事务日志')
    }
    const failures = []
    for (const item of [...transaction.writes].reverse()) {
      if (!item || typeof item.key !== 'string' || typeof item.tableName !== 'string') {
        failures.push('事务日志包含无效写入项')
        continue
      }
      const table = importTableByName[item.tableName]
      if (!table) {
        failures.push(`未知表 ${item.tableName}`)
        continue
      }
      try {
        const before = table.get(item.key)
        const beforeDigest = recordSha256(before)
        const prevDigest = item.prevExists ? recordSha256(item.prev) : 'missing'
        // Only undo our own value.  If another writer changed this key after
        // the partial activation, fail closed instead of destroying it.
        if (beforeDigest !== prevDigest && beforeDigest !== item.nextSha256) {
          failures.push(`${item.tableName}:${item.key} 已被其他写入修改，拒绝破坏性回滚`)
          continue
        }
        if (beforeDigest !== prevDigest) {
          if (item.prevExists) await table.put(item.key, cloneRecord(item.prev))
          else await table.delete(item.key)
        }
        const actual = table.get(item.key)
        const restored = item.prevExists
          ? recordSha256(actual) === recordSha256(item.prev)
          : actual === undefined
        if (!restored) failures.push(`${item.tableName}:${item.key} 恢复后校验失败`)
      } catch (error) {
        failures.push(`${item.tableName}:${item.key}: ${String(errorMessage(error))}`)
      }
    }
    try {
      const pointerKey = importActiveKey(sessionId)
      const currentPointer = T.branch.get(pointerKey) as ImportPointer | undefined
      const beforeDigest = recordSha256(currentPointer)
      const prevDigest = transaction.activePointerPrevExists
        ? recordSha256(transaction.activePointerPrev)
        : 'missing'
      const ownedByTransaction = currentPointer?.transactionId === transaction.transactionId
      if (beforeDigest !== prevDigest && !ownedByTransaction) {
        failures.push('active pointer 已被其他事务修改，拒绝破坏性回滚')
      } else if (beforeDigest !== prevDigest) {
        if (transaction.activePointerPrevExists) {
          await T.branch.put(pointerKey, cloneRecord(transaction.activePointerPrev))
        } else {
          await T.branch.delete(pointerKey)
        }
      }
      const actualPointer = T.branch.get(pointerKey)
      const pointerRestored = transaction.activePointerPrevExists
        ? recordSha256(actualPointer) === recordSha256(transaction.activePointerPrev)
        : actualPointer === undefined
      if (!pointerRestored) failures.push('active pointer 恢复后校验失败')
    } catch (error) {
      failures.push(`active pointer: ${String(errorMessage(error))}`)
    }
    const staging = cloneRecord(record)
    staging.status = 'staging'
    staging.recoveredAt = Date.now()
    delete staging.transaction
    delete staging.recoveryErrors
    if (!failures.length) {
      try {
        await T.branch.put(key, staging)
        if (recordSha256(T.branch.get(key)) !== recordSha256(staging)) failures.push('staging import record 恢复后校验失败')
      } catch (error) {
        failures.push(`staging import record: ${String(errorMessage(error))}`)
      }
    }
    if (failures.length) {
      const failed = { ...staging, status: 'recovery-required', transaction, recoveryErrors: failures }
      try { await T.branch.put(key, failed) } catch {}
      throw new Error(`角色卡导入回滚不完整，禁止继续激活：${failures.join('; ')}`)
    }
    return staging
  }

  const importSummary = (record: ImportRecord) => {
    assertImportRecordIntegrity(record)
    const coverage = importCoverage(record)
    return {
      importId: record.importId,
      sourceFile: record.sourceFile,
      mode: record.mode ?? 'replace',
      status: record.status,
      rawSha256: record.rawSha256,
      normalizedSha256: record.normalizedSha256,
      rawChars: record.rawChars,
      normalizedChars: record.normalizedChars,
      lineCount: record.lineCount,
      reviewComplete: record.reviewComplete === true,
      nextReadCursor: record.nextReadCursor ?? null,
      assignmentCount: (record.assignments ?? []).length,
      coverage: coverage.coverage,
      coveredLines: coverage.coveredLines,
      sourceLines: coverage.sourceLines,
      coveredChars: coverage.coveredChars,
      sourceChars: coverage.sourceChars,
      createdAt: record.createdAt,
      activatedAt: record.activatedAt ?? null,
      ...(record.sourceEnvelope ? {format:record.sourceEnvelope.format, suggestedMapping:true,
        warnings:record.sourceEnvelope.warnings} : {}),
    }
  }

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_card_import_begin',
        '开始无损读卡导入。直接读取 ST/TauriTavern PNG/JSON，或 Markdown/TXT；保留原件、字段来源与哈希。PNG/JSON 不经过 anydoc。返回 import_id、行数和审阅入口。',
        {
          type: 'object',
          properties: {
            source_file: { type: 'string' },
            mode: { type: 'string', enum: ['replace', 'merge'], description: '完整新卡默认 replace；仅明确导入补充包时使用 merge' },
          },
          required: ['source_file'],
          additionalProperties: false,
        },
        async (args, exec) => {
          const session = await sessionOf(exec)
          const requestedPath = String(args.source_file ?? '').trim()
          if (!requestedPath) return { ok: false, error: 'source_file 不能为空' }
          await deps.beforeWrite?.(exec)
          if(!eventsOf(exec.agent?.session).some(e=>e.type==='subagent/descriptor')) {
            let job
            try{job=await beginCardWorkflow(session,'card-import',requestedPath,exec.agent)}catch(error){return {ok:false,error:String((error as { message: unknown }).message)}}
            if(job.execution==='spawn') {
              try{await resumeCardWorkflows(session,exec.agent,exec.signal)}catch(error){if(!isInlinePending(error))throw error}
              return {ok:true,job:T.branch.get(cardWorkflowKey(job.id)),pending:true}
            }
          }
          const workflow=activeCardWorkflow(session)
          if(workflow?.kind==='card-import' && resolve(session.header.cwd,requestedPath)!==workflow.source.sourceFile)return {ok:false,error:'任务只能读取已冻结的角色卡文件'}
          const resumed=workflow?[...T.branch.entries()].map(([,v])=>v as ImportRecord).find(v=>v?.workflowId===workflow.id&&v.importId):null
          if(resumed)return {ok:true,...importSummary(resumed),resumed:true}
          let source
          try {
            source = resolveImportSource(session, requestedPath)
          } catch (error) {
            return { ok: false, error: String(errorMessage(error)) }
          }
          if (source.sourceBytes > IMPORT_LIMITS.maxBytes) return { ok: false, error: `角色卡超过 ${IMPORT_LIMITS.maxBytes.toLocaleString()} 字节，拒绝静默截断；请先拆成多个来源文件` }
          // Read bytes first so the recorded byte count describes exactly the
          // archived source, not a possibly changed file observed by stat().
          const rawBytes = source.bytes
          if (rawBytes.length > IMPORT_LIMITS.maxBytes) return { ok: false, error: `角色卡超过 ${IMPORT_LIMITS.maxBytes.toLocaleString()} 字节，拒绝静默截断；请先拆成多个来源文件` }
          let decoded, projected
          try {
            if (['.png','.json'].includes(source.extension)) {
              decoded = decodeTavernCard(rawBytes, source.extension)
              projected = projectTavernCard(decoded)
            }
          } catch (error) { return {ok:false,error:String((error as { message: unknown }).message)} }
          const rawSource = decoded ? JSON.stringify(decoded.document,null,2) : rawBytes.toString('utf8')
          if (!decoded && !Buffer.from(rawSource, 'utf8').equals(rawBytes)) return { ok: false, error: '角色卡不是有效 UTF-8；拒绝以替换字符损坏原文' }
          if (rawSource.length > IMPORT_LIMITS.maxChars) return { ok: false, error: `角色卡超过 ${IMPORT_LIMITS.maxChars.toLocaleString()} 字符，拒绝静默截断；请先拆成多个来源文件` }
          const normalizedSource = projected?.text ?? deescapeMarkdown(rawSource).replace(/\r\n?/g, '\n')
          if (normalizedSource.length > IMPORT_LIMITS.maxChars) return {ok:false,error:'角色卡投影超过字符上限；拒绝静默截断'}
          if (!normalizedSource.trim()) return { ok: false, error: '角色卡规范化后没有任何有效内容，拒绝创建空导入' }
          const importId = randomUUID()
          const splitLines = normalizedSource.split('\n')
          const lineCount = splitLines.length - (normalizedSource.endsWith('\n') ? 1 : 0)
          if (lineCount < 1 || lineCount > IMPORT_LIMITS.maxLines) return { ok: false, error: `角色卡行数超过上限 ${IMPORT_LIMITS.maxLines.toLocaleString()}` }
          const lines = splitLines.slice(0, lineCount)
          const lineStarts = []
          let offset = 0
          for (let index = 0; index < lineCount; index++) {
            lineStarts.push(offset)
            offset += lines[index]!.length + (index < lineCount - 1 || normalizedSource.endsWith('\n') ? 1 : 0)
          }
          const headings = lines
            .map((line, index) => ({ line: index + 1, text: line.trim() }))
            .filter((entry) => /^(?:#{1,6}\s+|={2,}.+={2,}$|【.+】$)/.test(entry.text))
            .slice(0, 200)
          const record: ImportRecord = {
            schemaVersion: decoded ? 4 : 3,
            importId,
            workflowId:workflow?.id,
            workflowGeneration:workflow?.generation,
            sessionId: session.id,
            sourceFile: source.sourcePath,
            workspaceRoot: source.workspaceRoot,
            sourceBytes: rawBytes.length,
            sourceMtimeMs: source.sourceMtimeMs,
            normalizer: decoded ? 'tavern-fields-v1' : IMPORT_NORMALIZER,
            ...(decoded ? { sourceEnvelope:{schemaVersion:1, extension:source.extension, format:decoded.format,
              base64:rawBytes.toString('base64'), sourceSha256:decoded.sourceSha256, warnings:projected!.warnings} } : {}),
            mode: args.mode === 'merge' ? 'merge' : 'replace',
            rawSource,
            normalizedSource,
            lines,
            lineStarts,
            rawSha256: sha256(rawBytes),
            normalizedSha256: sha256(normalizedSource),
            rawChars: rawSource.length,
            normalizedChars: normalizedSource.length,
            lineCount,
            headings,
            assignments: [],
            readRanges: [],
            nextReadCursor: 1,
            reviewComplete: false,
            status: 'staging',
            createdAt: Date.now(),
          }
          await T.branch.put(importRecordKey(session.id, importId), record)
          return { ok: true, ...importSummary(record), headings, nextCursor: 1 }
        }
      )
    ),
    'roleplay: tool rp_card_import_begin'
  )

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_card_import_chunk',
        '按行分页读取已归档角色卡原文。首次审阅必须严格按 nextCursor 从 1 连续读到 null；完成后可按任意合法 cursor 复查。',
        {
          type: 'object',
          properties: {
            import_id: { type: 'string' },
            cursor: { type: 'number' },
            max_lines: { type: 'number' },
          },
          required: ['import_id', 'cursor'],
          additionalProperties: false,
        },
        async (args, exec) => {
          const session = await sessionOf(exec)
          return withImportLock(session.id, args.import_id, async () => {
            const key = importRecordKey(session.id, args.import_id)
            const record = T.branch.get(key) as ImportRecord | undefined
            if (!record) return { ok: false, error: 'import_id 不存在' }
            try { assertImportRecordIntegrity(record) }
            catch (error) { return { ok: false, recoveryRequired: true, error: String(errorMessage(error)) } }
            if (!['staging', 'active'].includes(record.status)) {
              return { ok: false, error: `import 当前状态为 ${String(record.status)}，必须先完成恢复` }
            }
            const start = Math.floor(Number(args.cursor))
            if (!Number.isSafeInteger(start) || start < 1 || start > record.lineCount) {
              return { ok: false, error: `cursor 必须是 1-${record.lineCount} 的整数` }
            }
            const maxLines = Math.min(300, Math.max(20, Math.floor(Number(args.max_lines) || 160)))
            const end = Math.min(record.lineCount, start + maxLines - 1)
            const priorRead = (record.readRanges ?? []).find((range) => range.startLine === start && range.endLine === end)
            const historicalRetry = record.status === 'staging' && record.reviewComplete !== true && start !== record.nextReadCursor && priorRead
            if (record.status === 'staging' && record.reviewComplete !== true && start !== record.nextReadCursor && !historicalRetry) {
              return { ok: false, error: `首次审阅不得跳页；下一块必须从 cursor=${record.nextReadCursor} 开始` }
            }
            const responseNextCursor = historicalRetry
              ? record.nextReadCursor
              : end < record.lineCount ? end + 1 : null
            let saved = record
            if (record.status === 'staging' && record.reviewComplete !== true && !historicalRetry) {
              saved = cloneRecord(record)
              saved.readRanges = [...(record.readRanges ?? []), { startLine: start, endLine: end, sourceSha256: record.normalizedSha256, readAt: Date.now() }]
              saved.nextReadCursor = responseNextCursor
              saved.reviewComplete = responseNextCursor === null
              saved.updatedAt = Date.now()
              await T.branch.put(key, saved)
            }
            const numberedText = record.lines
              .slice(start - 1, end)
              .map((line, index) => `${start + index}\t${line}`)
              .join('\n')
            return {
              ok: true,
              importId: record.importId,
              startLine: start,
              endLine: end,
              numberedText: fenceCardContent(numberedText, 'source'),
              nextCursor: responseNextCursor,
              reviewComplete: saved.reviewComplete === true,
              normalizedSha256: record.normalizedSha256,
            }
          })
        }
      )
    ),
    'roleplay: tool rp_card_import_chunk'
  )

  const IMPORT_TARGETS = new Set([
    'card', 'worldbook', 'status', 'core-setting', 'plot-guidance', 'rule-narrative', 'rule-reply', 'rule-style',
    'opening', 'beauty-css', 'beauty-js', 'beauty-regex', 'archive-only',
  ])
  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_card_import_stage',
        '提交角色卡分类元数据与原文行跨度。必须先读完全文；同时通过 resource_title 给资源库起一个体现整本书主题、方便辨认的名称，不使用 UUID 或乱码原文件名；这不是修改角色名字。禁止传 content/正则正文，后端只从 sourceSpans 原样物化。可分批追加，纠错时 replace_all=true。\n'+CARD_CLASSIFICATION_GUIDE,
        {
          type: 'object',
          properties: {
            import_id: { type: 'string' },
            resource_title: { type: 'string', maxLength: 90, description: 'LLM 读完后给整本书起的主题名称，不含扩展名；仅影响资源显示和下载文件名，原卡字节与人设不变。' },
            replace_all: { type: 'boolean' },
            use_suggested: { type: 'boolean', description:'仅当 PNG/JSON 完整审阅确认字段分类符合语义时设 true；字段混合多个模块时用 assignments 细分完整原文跨度。' },
            assignments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  target: { type: 'string', enum: [...IMPORT_TARGETS], description: '人物用 card；常驻世界基础、核心威胁和长期矛盾用 core-setting；路线、触发条件与可能结局用 plot-guidance（不是已发生剧情）；被动可查的地点/势力/概念条目用 worldbook；状态模板用 status；叙事/回复/文风要求与完整写作样本分别用 rule-narrative/rule-reply/rule-style；开场用 opening；美化用 beauty-css/beauty-js/beauty-regex；其余原文用 archive-only。不得把完整样本压缩为风格关键词。' },
                  id: { type: 'string' }, name: { type: 'string' }, kind: { type: 'string' },
                  locked: { type: 'boolean' }, secondary: { type: 'boolean' }, aliases: { type: 'array', items: { type: 'string' } },
                  keywords: { type: 'array', items: { type: 'string' } }, triggers: { type: 'array', items: { type: 'string' } },
                  priority: { type: 'number' }, token_budget: { type: 'number' }, always_on: { type: 'boolean' },
                  order: { type: 'number' }, merge_group: { type: 'string' }, reuse_reason: { type: 'string' },
                  sourceSpans: { type: 'array', items: { type: 'object', properties: { startLine: { type: 'number' }, endLine: { type: 'number' } }, required: ['startLine', 'endLine'], additionalProperties: false } },
                },
                required: ['target', 'sourceSpans'],
                additionalProperties: false,
              },
            },
          },
          required: ['import_id'],
          additionalProperties: false,
        },
        async (args, exec) => {
          const session = await sessionOf(exec)
          return withImportLock(session.id, args.import_id, async () => {
            const key = importRecordKey(session.id, args.import_id)
            const record = T.branch.get(key) as ImportRecord | undefined
            if (!record || record.status !== 'staging') return { ok: false, error: 'import_id 不存在或已结束 staging' }
            try { assertImportRecordIntegrity(record) }
            catch (error) { return { ok: false, recoveryRequired: true, error: String(errorMessage(error)) } }
            try { assertReviewProof(record) }
            catch (error) { return { ok: false, error: String(errorMessage(error)) } }
            const incoming: ImportAssignment[] = []
            try {
              if (args.use_suggested === true) {
                if (!record.sourceEnvelope) throw new Error('只有结构化 PNG/JSON 原件支持建议映射')
                const decoded = decodeTavernCard(Buffer.from(record.sourceEnvelope.base64,'base64'), record.sourceEnvelope.extension)
                args = {...args, replace_all:true, assignments:projectTavernCard(decoded).assignments}
              }
              if (!Array.isArray(args.assignments)) throw new Error('assignments 必须是数组')
              // Validate aggregate payload size before slicing/hashing spans;
              // otherwise thousands of repeated whole-card secondary spans can
              // monopolize the process even though their count is bounded.
              assertAssignmentBudget(args.assignments)
              assertReferenceBudget(record, args.assignments)
              for (const raw of args.assignments ?? []) {
                const target = String(raw.target ?? '')
                if (!IMPORT_TARGETS.has(target)) return { ok: false, error: `未知 target: ${target}` }
                const sourceSpans = normalizeSourceSpans(raw.sourceSpans, record.lineCount)
                if (!sourceSpans.length) return { ok: false, error: `${target} 缺少 sourceSpans` }
                const secondary = raw.secondary === true
                const reuseReason = String(raw.reuse_reason ?? '').trim()
                if (secondary && target === 'archive-only') return { ok: false, error: 'archive-only 不能标记为 secondary' }
                if (secondary && !reuseReason) return { ok: false, error: `${target} 的 secondary 复用必须填写 reuse_reason` }
                let id
                let kind = raw.kind === undefined ? undefined : String(raw.kind)
                if (target === 'card') {
                  kind = kind === 'user' ? 'user' : 'npc'
                  id = kind === 'user' ? 'user' : stableImportId(raw.id ?? raw.name)
                } else if (target === 'worldbook') {
                  id = stableImportId(raw.id ?? raw.name)
                } else if (raw.id !== undefined) {
                  id = stableImportId(raw.id)
                }
                const finiteNumber = (value: unknown, fallback: number, minimum: number, maximum: number) => {
                  const parsed = Number(value)
                  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback
                }
                const assignment = {
                  target,
                  ...(id ? { id } : {}),
                  ...(raw.name === undefined ? {} : { name: String(raw.name).trim() }),
                  ...(kind === undefined ? {} : { kind }),
                  locked: raw.locked === true,
                  secondary,
                  ...(reuseReason ? { reuse_reason: reuseReason } : {}),
                  ...(raw.merge_group === undefined ? {} : { merge_group: String(raw.merge_group).trim() }),
                  aliases: Array.isArray(raw.aliases) ? raw.aliases.map(String) : [],
                  keywords: Array.isArray(raw.keywords) ? raw.keywords.map(String) : [],
                  triggers: Array.isArray(raw.triggers) ? raw.triggers.map(String) : [],
                  priority: finiteNumber(raw.priority, 0, -1_000_000, 1_000_000),
                  token_budget: finiteNumber(raw.token_budget, 0, 0, 10_000_000),
                  always_on: raw.always_on === true,
                  order: finiteNumber(raw.order, sourceSpans[0]!.startLine, -1_000_000_000, 1_000_000_000),
                  sourceSpans,
                  sourceSha256: sha256(spanText(record, sourceSpans)),
                  stagedAt: Date.now(),
                }
                incoming.push(assignment)
              }
              const assignments = args.replace_all === true ? incoming : [...(record.assignments ?? []), ...incoming]
              assertAssignmentBudget(assignments)
              assertReferenceBudget(record, assignments)
              validateAssignmentIdentities(assignments)
              const resourceTitle=args.resource_title===undefined?record.resourceTitle:String(args.resource_title).normalize('NFC').trim()
              if(args.resource_title!==undefined&&(!resourceTitle||resourceTitle.length>90))throw new Error('资源主题名称需为 1 至 90 字符')
              const next = { ...cloneRecord(record), assignments, ...(resourceTitle?{resourceTitle}:{}), updatedAt: Date.now() }
              await T.branch.put(key, next)
              const coverage = importCoverage(next)
              return {
                ok: true,
                importId: next.importId,
                assignmentCount: next.assignments.length,
                coverage: coverage.coverage,
                coveredLines: coverage.coveredLines,
                sourceLines: coverage.sourceLines,
                coveredChars: coverage.coveredChars,
                sourceChars: coverage.sourceChars,
                uncoveredRanges: coverage.uncoveredRanges.slice(0, 40),
                overlapRanges: coverage.overlapRanges.slice(0, 40),
              }
            } catch (error) {
              return { ok: false, error: String(errorMessage(error)) }
            }
          })
        }
      )
    ),
    'roleplay: tool rp_card_import_stage'
  )

  ctx.effect(() =>
    ctx.tools.register(
      simpleTool(
        'rp_card_import_finalize',
        '校验全文已审阅、原文字符 100% 已分类后以回滚日志激活；遗漏、主归属重叠、跨度哈希变化或写后校验失败都会拒绝提交。',
        {
          type: 'object',
          properties: {
            import_id: { type: 'string' },
            expected_sha256: { type: 'string' },
          },
          required: ['import_id', 'expected_sha256'],
          additionalProperties: false,
        },
        async (args, exec) => {
          const session = await sessionOf(exec)
          return withImportLock(session.id, args.import_id, async () => {
            const key = importRecordKey(session.id, args.import_id)
            let record = T.branch.get(key) as ImportRecord | undefined
            if (!record) return { ok: false, error: 'import_id 不存在' }
            try { assertImportRecordIntegrity(record) }
            catch (error) { return { ok: false, recoveryRequired: true, error: String(errorMessage(error)) } }
            if (record.status === 'active') {
              if (String(args.expected_sha256).toLowerCase() !== String(record.normalizedSha256).toLowerCase()) {
                return { ok: false, error: 'import_id 已激活，但 expected_sha256 不匹配' }
              }
              const pointer = T.branch.get(importActiveKey(session.id)) as ImportPointer | undefined
              if (pointer?.importId !== record.importId) {
                return { ok: true, idempotent: true, current: false, ...importSummary(record), ...(record.activation?.summary ?? {}) }
              }
              if (!record.activation || typeof record.activation.transactionId !== 'string'
                || !Array.isArray(record.activation.writeDigests) || record.activation.writeDigests.length === 0) {
                return { ok: false, recoveryRequired: true, error: 'active import record 缺少完整激活证明' }
              }
              if (pointer?.normalizedSha256 !== record.normalizedSha256
                || pointer?.transactionId !== record.activation.transactionId) {
                return { ok: false, recoveryRequired: true, error: '活动导入指针与 active import record 不一致' }
              }
              try {
                assertAssignmentBudget(record.assignments ?? [])
                assertReferenceBudget(record, record.assignments ?? [])
                validateAssignmentIdentities(record.assignments ?? [])
                for (const assignment of record.assignments ?? []) {
                  const normalized = normalizeSourceSpans(assignment.sourceSpans, record.lineCount)
                  if (stableJson(normalized) !== stableJson(assignment.sourceSpans)) throw new Error('active sourceSpans 非规范')
                  const digest = sha256(spanText(record, normalized))
                  if (digest !== assignment.sourceSha256 || digest !== assignment.materializedSha256) {
                    throw new Error(`${assignment.target} 的 active 来源哈希不一致`)
                  }
                }
              } catch (error) {
                return { ok: false, recoveryRequired: true, error: String(errorMessage(error)) }
              }
              const currentCoverage = importCoverage(record)
              if (pointer?.coverageSha256 !== recordSha256(currentCoverage)
                || (record.coverage !== undefined && recordSha256(record.coverage) !== recordSha256(currentCoverage))) {
                return { ok: false, recoveryRequired: true, error: '活动导入覆盖率证明与当前 assignments 不一致' }
              }
              for (const digest of record.activation.writeDigests) {
                const table = importTableByName[digest.tableName]
                if (!table || recordSha256(table.get(digest.key)) !== digest.sha256) {
                  return { ok: false, recoveryRequired: true, error: `已激活材料校验失败：${digest.tableName}:${digest.key}` }
                }
              }
              return { ok: true, idempotent: true, current: true, ...importSummary(record), ...(record.activation?.summary ?? {}) }
            }
            if (record.status === 'committing' || record.status === 'recovery-required') {
              try {
                record = await restoreImportTransaction(session.id, key, record)
              } catch (error) {
                return { ok: false, recoveryRequired: true, error: String(errorMessage(error)) }
              }
            }
            if (record.status !== 'staging') return { ok: false, error: `import 当前状态为 ${String(record.status)}，不能激活` }
            if (![3,4].includes(record.schemaVersion)) return { ok: false, error: '旧版 staging 记录缺少全文审阅证明；请重新执行 rp_card_import_begin' }
            try {
              assertAssignmentBudget(record.assignments ?? [])
              assertReferenceBudget(record, record.assignments ?? [])
              // Re-normalize from the durable record at the commit boundary;
              // a hand-edited/corrupt record must never reach spanText().
              for (const assignment of record.assignments ?? []) {
                const normalized = normalizeSourceSpans(assignment.sourceSpans, record.lineCount)
                if (stableJson(normalized) !== stableJson(assignment.sourceSpans)) {
                  throw new Error('sourceSpans 未按规范排序或包含重复跨度')
                }
              }
            } catch (error) {
              return { ok: false, recoveryRequired: true, error: String(errorMessage(error)) }
            }
            try { assertReviewProof(record) }
            catch (error) { return { ok: false, recoveryRequired: true, error: String(errorMessage(error)) } }
            if (String(args.expected_sha256).toLowerCase() !== String(record.normalizedSha256).toLowerCase()) {
              return { ok: false, error: '来源 SHA-256 不匹配，拒绝对变化后的原卡提交旧分类' }
            }
            if (sha256(record.normalizedSource) !== record.normalizedSha256) {
              return { ok: false, error: '归档原文完整性校验失败，拒绝激活' }
            }
            if (!(record.assignments ?? []).some((assignment) => assignment.target !== 'archive-only')) {
              return { ok: false, error: '全部原文均被归入 archive-only；至少需要一个可用角色卡/世界书/规则/开场栏目' }
            }
            try {
              validateAssignmentIdentities(record.assignments ?? [])
              for (const assignment of record.assignments ?? []) {
                const materializedSha256 = sha256(spanText(record, assignment.sourceSpans))
                if (materializedSha256 !== assignment.sourceSha256) {
                  return { ok: false, error: `${assignment.target} 的 sourceSpans 哈希已变化，拒绝激活` }
                }
              }
            } catch (error) {
              return { ok: false, error: String(errorMessage(error)) }
            }
            const coverage = importCoverage(record)
            if (coverage.uncovered.length || coverage.overlaps.length || coverage.coveredChars !== coverage.sourceChars) {
              return {
                ok: false,
                error: `导入覆盖率 ${(coverage.coverage * 100).toFixed(2)}%，未达到原文字符 100%`,
                uncoveredRanges: coverage.uncoveredRanges.slice(0, 200),
                overlapRanges: coverage.overlapRanges.slice(0, 200),
                coveredChars: coverage.coveredChars,
                sourceChars: coverage.sourceChars,
              }
            }

            // Materialize in source order. `order` is descriptive metadata and
            // must not let the model rearrange the author's paragraphs inside
            // a card/rule/status/opening assembled from multiple assignments.
            const assignments = [...record.assignments]
              .sort((left, right) => left.sourceSpans[0]!.startLine - right.sourceSpans[0]!.startLine || Number(left.order) - Number(right.order))
            const cards = new Map<string, MaterialPiece[]>()
            const worldbook = new Map<string, MaterialPiece[]>()
            type TextPiece = ImportAssignment & { content: string }
            const rules: Record<string, TextPiece[]> = Object.fromEntries(RULE_TEXT_FIELDS.map(field=>[field,[]]))
            const ruleSources: Record<string, SourceDescriptor[]> = Object.fromEntries(RULE_TEXT_FIELDS.map(field=>[field,[]]))
            const status: TextPiece[] = []
            const statusSources: SourceDescriptor[] = []
            const opening: TextPiece[] = []
            const openingSources: SourceDescriptor[] = []
            const archiveSources: SourceDescriptor[] = []
            const beauty: { css: TextPiece[]; js: TextPiece[]; regexRules: { match: string; replace: string; source: SourceDescriptor }[]; sources: SourceDescriptor[] } = { css: [], js: [], regexRules: [], sources: [] }
            const tavernProjection = record.sourceEnvelope
              ? projectTavernCard(decodeTavernCard(Buffer.from(record.sourceEnvelope.base64,'base64'),record.sourceEnvelope.extension)) : null
            const tavernWorldbookById = new Map<string, NonNullable<typeof tavernProjection>['worldbook'][number]>()
            for (const entry of tavernProjection?.worldbook ?? []) {
              if (!tavernWorldbookById.has(entry.id)) tavernWorldbookById.set(entry.id, entry)
            }
            try {
              for (const assignment of assignments) {
                const content = spanText(record, assignment.sourceSpans)
                const source = sourceDescriptor(record, assignment)
                if (assignment.target === 'card') {
                  const id = assignment.kind === 'user' ? 'user' : assignment.id!
                  const list = cards.get(id) ?? []
                  list.push({ ...assignment, content, source })
                  cards.set(id, list)
                } else if (assignment.target === 'worldbook') {
                  const list = worldbook.get(assignment.id!) ?? []
                  list.push({ ...assignment, content, source })
                  worldbook.set(assignment.id!, list)
                } else if (assignment.target === 'status') {
                  status.push({ ...assignment, content })
                  statusSources.push(source)
                } else if (RULE_IMPORT_FIELDS[assignment.target]) {
                  const field=RULE_IMPORT_FIELDS[assignment.target]!
                  rules[field]!.push({ ...assignment, content })
                  ruleSources[field]!.push(source)
                } else if (assignment.target === 'opening') {
                  opening.push({ ...assignment, content })
                  openingSources.push(source)
                } else if (assignment.target === 'beauty-css') {
                  const cssSyntax=content.replace(/\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g,'')
                  if(/<\/?(?:section|div|article|aside|main|table|details|span|p|body|html|svg|script)\b[^>]*>/i.test(cssSyntax))throw new Error('beauty-css 包含 HTML 结构。状态栏模板及配套 CSS 必须归入 status；请调整 sourceSpans 分类后重新 finalize，原文不能改写。')
                  beauty.css.push({ ...assignment, content })
                  beauty.sources.push({ kind: 'css', ...source })
                } else if (assignment.target === 'beauty-js') {
                  beauty.js.push({ ...assignment, content })
                  beauty.sources.push({ kind: 'js', ...source })
                } else if (assignment.target === 'beauty-regex') {
                  const parsed = parseRegexRules(content)
                  beauty.regexRules.push(...parsed.map((rule) => ({ ...rule, source })))
                  beauty.sources.push({ kind: 'regex', ...source })
                } else if (assignment.target === 'archive-only') {
                  archiveSources.push({ ...source, ...(assignment.name ? { name: assignment.name } : {}) })
                }
              }
            } catch (error) {
              return { ok: false, error: String(errorMessage(error)) }
            }

            const writes: ImportWrite[] = []
            const writeKeys = new Set()
            const addWrite = (tableName: string, entryKey: string, next: unknown) => {
              const table = importTableByName[tableName]
              const identity = `${tableName}:${entryKey}`
              if (!table || writeKeys.has(identity)) throw new Error(`重复事务写目标：${identity}`)
              writeKeys.add(identity)
              writes.push({
                tableName,
                table,
                key: entryKey,
                prev: cloneRecord(table.get(entryKey)),
                next: cloneRecord(next),
              })
            }
            // An assignment may itself contain multiple non-contiguous spans.
            // Sorting assignments by their first span is insufficient when
            // another assignment is interleaved between two of those spans;
            // flatten and sort every fragment so the materialized text always
            // follows the author's source order.
            const joinImported = (parts: readonly (string | TextPiece)[]) => parts
              .flatMap<{ startLine: number; endLine: number; text: string; partIndex?: number; spanIndex?: number }>((part, partIndex) => {
                if (typeof part === 'string') return [{ startLine: partIndex, endLine: partIndex, text: part }]
                return (part?.sourceSpans ?? []).map((span, spanIndex) => ({
                  startLine: span.startLine,
                  endLine: span.endLine,
                  partIndex,
                  spanIndex,
                  text: spanText(record, [span]),
                }))
              })
              .sort((left, right) => left.startLine - right.startLine || left.endLine - right.endLine || Number(left.partIndex) - Number(right.partIndex) || Number(left.spanIndex) - Number(right.spanIndex))
              .map((part) => part.text)
              .join('')
            const mergeText = (previous: unknown, added: unknown) => {
              const before = String(previous ?? '')
              const after = String(added ?? '')
              if (!before) return after
              if (!after) return before
              return `${before}${before.endsWith('\n') || after.startsWith('\n') ? '' : '\n'}${after}`
            }
            const mergeUniqueStrings = (...groups: unknown[][]) => [...new Set(groups.flat().filter((value) => value !== undefined && value !== null).map(String))]
            const atSeq = lastSeq(session)
            const replaceMode = record.mode !== 'merge'
            try {
              for (const [id, pieces] of cards) {
                const entryKey = keyOf(session.id, id)
                const prev = cloneRecord(T.cards.get(entryKey))
                const importedContent = joinImported(pieces)
                const importedSources = pieces.map((piece) => piece.source)
                addWrite('cards', entryKey, {
                  schemaVersion: 1,
                  ...(replaceMode ? {} : prev ?? {}),
                  id,
                  name: String(pieces[0]?.name || prev?.name || id),
                  kind: pieces[0]?.kind === 'user' ? 'user' : 'npc',
                  content: replaceMode ? importedContent : mergeText(prev?.content, importedContent),
                  locked: (!replaceMode && prev?.locked === true) || pieces.some((piece) => piece.locked === true),
                  version: (Number(prev?.version) || 0) + 1,
                  updatedAtSeq: atSeq,
                  importId: record.importId,
                  sources: replaceMode ? importedSources : [...(prev?.sources ?? []), ...importedSources],
                  // In merge mode the new fragment is source-verified, but it
                  // cannot retroactively certify pre-existing agent-authored
                  // text that had no source provenance.
                  verified: replaceMode || !prev || prev.verified === true,
                })
              }
              for (const [id, pieces] of worldbook) {
                const entryKey = keyOf(session.id, id)
                const prev = cloneRecord(T.worldbook.get(entryKey))
                const first: Partial<MaterialPiece> = pieces[0] ?? {}
                const importedContent = joinImported(pieces)
                const importedSources = pieces.map((piece) => piece.source)
                const tavernEntry = tavernWorldbookById.get(id)
                addWrite('worldbook', entryKey, {
                  schemaVersion: 1,
                  ...(replaceMode ? {} : prev ?? {}),
                  id,
                  kind: first.kind || prev?.kind || 'term',
                  name: String(first.name || prev?.name || id),
                  aliases: mergeUniqueStrings(replaceMode ? [] : prev?.aliases ?? [], pieces.flatMap((piece) => piece.aliases ?? [])),
                  keywords: mergeUniqueStrings(replaceMode ? [] : prev?.keywords ?? [], pieces.flatMap((piece) => piece.keywords ?? [])),
                  triggers: mergeUniqueStrings(replaceMode ? [] : prev?.triggers ?? [], pieces.flatMap((piece) => piece.triggers ?? [])),
                  priority: Math.max(replaceMode ? 0 : Number(prev?.priority) || 0, ...pieces.map((piece) => Number(piece.priority) || 0)),
                  tokenBudget: Math.max(replaceMode ? 0 : Number(prev?.tokenBudget) || 0, ...pieces.map((piece) => Number(piece.token_budget) || 0), 400),
                  alwaysOn: (!replaceMode && prev?.alwaysOn === true) || pieces.some((piece) => piece.always_on === true),
                  content: replaceMode ? importedContent : mergeText(prev?.content, importedContent),
                  locked: (!replaceMode && prev?.locked === true) || pieces.some((piece) => piece.locked === true),
                  version: (Number(prev?.version) || 0) + 1,
                  updatedAtSeq: atSeq,
                  importId: record.importId,
                  sources: replaceMode ? importedSources : [...(prev?.sources ?? []), ...importedSources],
                  ...(tavernEntry ? {
                    enabled:tavernEntry.enabled,
                    tavern:tavernEntry,
                  } : {}),
                  verified: replaceMode || !prev || prev.verified === true,
                })
              }
              if (replaceMode) {
                const prefix = `${session.id}__`
                for (const [existingKey, existing] of T.cards.entries()) {
                  if (!existingKey.startsWith(prefix) || !existing) continue
                  if (!cards.has(existingKey.slice(prefix.length))) addWrite('cards', existingKey, undefined)
                }
                for (const [existingKey, existing] of T.worldbook.entries()) {
                  if (!existingKey.startsWith(prefix) || !existing) continue
                  if (!worldbook.has(existingKey.slice(prefix.length))) addWrite('worldbook', existingKey, undefined)
                }
              }

              const previousRules = cloneRecord(T.rules.get(keyOf(session.id, 'spec')))
              const previousBeauty = previousRules?.beauty ?? {}
              const newRuleText = Object.fromEntries(RULE_TEXT_FIELDS.map(field=>[field,joinImported(rules[field]!)]))
              const nextBeauty = {
                regexRules: replaceMode
                  ? beauty.regexRules
                  : [...(previousBeauty.regexRules ?? []), ...beauty.regexRules],
                css: replaceMode ? joinImported(beauty.css) : mergeText(previousBeauty.css, joinImported(beauty.css)),
                js: replaceMode ? joinImported(beauty.js) : mergeText(previousBeauty.js, joinImported(beauty.js)),
                sources: replaceMode
                  ? beauty.sources
                  : [...(previousBeauty.sources ?? []), ...beauty.sources],
              }
              const previousRuleSources = previousRules?.sources ?? {}
              const nextRules = {
                schemaVersion: 1,
                ...(replaceMode ? {} : previousRules ?? {}),
                ...Object.fromEntries(RULE_TEXT_FIELDS.filter(field=>replaceMode||newRuleText[field]).map(field=>[field,replaceMode?newRuleText[field]:mergeText(previousRules?.[field],newRuleText[field])])),
                beauty: nextBeauty,
                sources: {
                  ...Object.fromEntries(RULE_TEXT_FIELDS.map(field=>[field,replaceMode?ruleSources[field]:[...(previousRuleSources[field]??[]),...ruleSources[field]!]])),
                  archiveOnly: replaceMode ? archiveSources : [...(previousRuleSources.archiveOnly ?? []), ...archiveSources],
                },
                importId: record.importId,
                verified: replaceMode || !previousRules || previousRules.verified === true,
                updatedAt: Date.now(),
                updatedAtSeq: atSeq,
              }
              addWrite('rules', keyOf(session.id, 'spec'), nextRules)

              const previousStatus = cloneRecord(T.status.get(keyOf(session.id, 'spec')))
              const importedStatus = joinImported(status)
              if (importedStatus) {
                const headings = [...record.normalizedSource.matchAll(/^(#{1,6})[ \t]+(.+)$/gm)]
                for (let index = 0; index < headings.length; index++) {
                  const heading = headings[index]!
                  if (!/(?:状态栏|\bstatus(?:\s+(?:panel|bar))?\b)/i.test(heading[2]!)) continue
                  const end = headings.slice(index + 1).find(row => row[1]!.length <= heading[1]!.length)?.index ?? record.normalizedSource.length
                  const assets = cardCodeBlocks(record.normalizedSource.slice(heading.index, end)).blocks
                  for (const asset of assets) if (asset.language === 'css' && asset.code.trim() && !importedStatus.includes(asset.code.trim())) {
                    throw new Error('状态栏章节的配套 CSS 未归入 status；请补齐 status 的 sourceSpans，不要将它仅归入 beauty-css 或 archive-only。')
                  }
                }
                // Source spans stay verbatim. Validate the assembled render assets
                // before committing any writes; prose-only legacy rules remain valid.
                if (/<\/?[a-z][^>]*>|^ {0,3}(?:`{3,}|~{3,})(?:html|css)\b/im.test(importedStatus)) {
                  const rendering = statusTemplateDiagnostics(importedStatus)
                  if (!rendering.renderable) throw new Error(rendering.errors.join('；') + '；请补齐 status 的来源跨度，不要改写原卡。')
                }
                addWrite('status', keyOf(session.id, 'spec'), {
                  ...(replaceMode ? {} : previousStatus ?? {}),
                  text: replaceMode ? importedStatus : mergeText(previousStatus?.text, importedStatus),
                  templateHtml: replaceMode ? importedStatus : mergeText(previousStatus?.templateHtml, importedStatus),
                  sources: replaceMode ? statusSources : [...(previousStatus?.sources ?? []), ...statusSources],
                  importId: record.importId,
                  verified: replaceMode || !previousStatus || previousStatus.verified === true,
                  updatedAt: Date.now(),
                  updatedAtSeq: atSeq,
                })
              } else if (replaceMode && previousStatus) {
                addWrite('status', keyOf(session.id, 'spec'), undefined)
              }
              const previousPanel = cloneRecord(T.status.get(keyOf(session.id, 'panel')))
              if (replaceMode && previousPanel) addWrite('status', keyOf(session.id, 'panel'), undefined)

              const previousOpening = cloneRecord(T.opening.get(keyOf(session.id, 'scene')))
              const importedOpening = joinImported(opening)
              if (importedOpening) {
                addWrite('opening', keyOf(session.id, 'scene'), {
                  ...(replaceMode ? {} : previousOpening ?? {}),
                  text: replaceMode ? importedOpening : mergeText(previousOpening?.text, importedOpening),
                  sources: replaceMode ? openingSources : [...(previousOpening?.sources ?? []), ...openingSources],
                  importId: record.importId,
                  verified: replaceMode || !previousOpening || previousOpening.verified === true,
                  updatedAt: Date.now(),
                  updatedAtSeq: atSeq,
                })
              } else if (replaceMode && previousOpening) {
                addWrite('opening', keyOf(session.id, 'scene'), undefined)
              }

              const activeKey = importActiveKey(session.id)
              const activePointerPrev = cloneRecord(T.branch.get(activeKey))
              const transactionId = randomUUID()
              const transaction = {
                transactionId,
                preparedAt: Date.now(),
                activePointerPrevExists: activePointerPrev !== undefined,
                activePointerPrev,
                writes: writes.map((write) => ({
                  tableName: write.tableName,
                  key: write.key,
                  prevExists: write.prev !== undefined,
                  prev: cloneRecord(write.prev),
                  nextSha256: recordSha256(write.next),
                })),
              }
              const committingRecord = { ...cloneRecord(record), status: 'committing', transaction }
              try {
                await T.branch.put(key, committingRecord)
              } catch (error) {
                return { ok: false, error: `无法建立导入事务日志：${String(errorMessage(error))}` }
              }

              try {
                for (const write of writes) {
                  assertCardWorkflow(session,record)
                  const expectedPrev = recordSha256(write.prev)
                  const actualPrev = recordSha256(write.table.get(write.key))
                  if (actualPrev !== expectedPrev) {
                    throw new Error(`并发修改冲突：${write.tableName}:${write.key} 已不再等于事务快照，拒绝覆盖`)
                  }
                  if (write.next === undefined) await write.table.delete(write.key)
                  else await write.table.put(write.key, cloneRecord(write.next))
                }
                const failedWrite = writes.find((write) => !verifyWrite(write))
                if (failedWrite) throw new Error(`写后校验失败：${failedWrite.tableName}:${failedWrite.key}`)
                assertCardWorkflow(session,record)

                const activatedAt = Date.now()
                const activationSummary = {
                  cards: [...cards.keys()],
                  worldbook: [...worldbook.keys()],
                  rules: Object.fromEntries(Object.entries(rules).map(([name, value]) => [name, value.length])),
                  status: status.length > 0,
                  opening: opening.length > 0,
                  archiveOnly: archiveSources.length,
                  beauty: { cssChars: nextBeauty.css.length, jsChars: nextBeauty.js.length, regexRules: nextBeauty.regexRules.length },
                }
                const activePointer = {
                  importId: record.importId,
                  transactionId,
                  normalizedSha256: record.normalizedSha256,
                  coverageSha256: recordSha256(coverage),
                  activatedAt,
                }
                if (recordSha256(T.branch.get(activeKey)) !== recordSha256(activePointerPrev)) {
                  throw new Error('active pointer 在事务期间被其他写入修改，拒绝覆盖')
                }
                await T.branch.put(activeKey, activePointer)
                if (recordSha256(T.branch.get(activeKey)) !== recordSha256(activePointer)) {
                  throw new Error('active pointer 写后校验失败')
                }
                const activeRecord = {
                  ...cloneRecord(record),
                  status: 'active',
                  assignments: record.assignments.map((assignment) => ({
                    ...cloneRecord(assignment),
                    materializedSha256: sha256(spanText(record, assignment.sourceSpans)),
                  })),
                  coverage,
                  archiveSources,
                  activatedAt,
                  activation: {
                    transactionId,
                    writeDigests: writes.map((write) => ({ tableName: write.tableName, key: write.key, sha256: recordSha256(write.next) })),
                    summary: activationSummary,
                  },
                }
                await T.branch.put(key, activeRecord)
                if (recordSha256(T.branch.get(key)) !== recordSha256(activeRecord)) {
                  throw new Error('active import record 写后校验失败')
                }
                let resource=null
                assertCardWorkflow(session,activeRecord)
                try {resource=await archiveImported(session,activeRecord)}catch{}
                assertCardWorkflow(session,activeRecord)
                await completeCardWorkflow(session,activeRecord,{importId:activeRecord.importId,resourceId:resource?.resourceId??resource?.id??null})
                return { ok: true, ...importSummary(activeRecord), ...activationSummary,resourceId:resource?.resourceId??resource?.id??null }
              } catch (error) {
                try {
                  try { await T.branch.put(key, committingRecord) } catch {}
                  await restoreImportTransaction(session.id, key, committingRecord)
                  return {
                    ok: false,
                    rolledBack: true,
                    error: `激活失败，已完整恢复激活前状态：${String(errorMessage(error))}`,
                  }
                } catch (rollbackError) {
                  return {
                    ok: false,
                    recoveryRequired: true,
                    error: `激活失败且自动回滚不完整：${String(errorMessage(rollbackError))}`,
                  }
                }
              }
            } catch (error) {
              return { ok: false, error: String(errorMessage(error)) }
            }
          })
        }
      )
    ),
    'roleplay: tool rp_card_import_finalize'
  )
  return { importRecordKey, spanText, withImportLock, awaitImportBarrier, importSummary, assertImportRecordIntegrity }
}
