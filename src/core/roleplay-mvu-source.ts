import {createHash} from 'node:crypto'
import {recordSha256} from './roleplay-data.js'
import {assertImportRecordIntegrity, importCoverage} from './roleplay-import-record.js'
import {compileTavernOpeningCandidates, decodeTavernCard} from './tavern-card.js'
import type {ImportPointer, ImportRecord} from './roleplay-import-types.js'
import type {OpeningCatalog, OpeningSource} from './roleplay-opening-selection.js'
import type {TavernOpeningCandidate, TavernOpeningContext} from './tavern-card.js'
import {selectNativeMvuInitializationPolicy} from './tavern-mvu-initvar.js'
import {NATIVE_MVU_SOURCE_POLICY,isNativeMvuSourcePolicy,isNativeMvuYamlSourcePolicy} from './roleplay-mvu-source-policy.js'
import type {NativeMvuSourcePolicy} from './roleplay-mvu-source-policy.js'
import {cloneSchemaData,schemaTextSha256} from './tavern-mvu-schema-data.js'
import type {MvuJsonObject,SchemaMvuInitDataSource} from './tavern-mvu-initvar.js'
import type {MvuSchemaAuthorScript} from './tavern-mvu-schema-types.js'
export {NATIVE_MVU_SOURCE_POLICY,NATIVE_MVU_YAML_SOURCE_POLICY,isNativeMvuSourcePolicy,isNativeMvuYamlSourcePolicy}
  from './roleplay-mvu-source-policy.js'
export type {NativeMvuSourcePolicy} from './roleplay-mvu-source-policy.js'

const sha = (value: string) => createHash('sha256').update(value).digest('hex')
const hashPattern = /^[a-f0-9]{64}$/
const idPattern = /^[a-zA-Z0-9_-]{1,128}$/
const keyPattern = /^[a-zA-Z0-9_-]{1,256}$/
const MAX_BYTES = 1_048_576
const MAX_ROWS = 4096
type JsonObject = Record<string, unknown>
export type MvuSourceTable = 'branch' | 'cards' | 'worldbook' | 'rules' | 'status' | 'opening'
export interface MvuSourceRowRef {table: MvuSourceTable; key: string; exists: boolean; sha256: string}

/** Original activated author inputs, not a claim that any script is supported
 * or that an author realm has been loaded. Compiler assets and Native load
 * ownership are supplied separately by Core. */
export interface MvuSchemaAuthorSource {
  schemaVersion:1
  encoding:'native-mvu-author-source-v1'
  snapshot:Omit<MvuSourceSnapshot,'policy'|'encoding'|'snapshotSha256'> & {
    encoding:'native-mvu-author-source-snapshot-v1'
    documentSha256:string
    snapshotSha256:string
  }
  scripts:readonly Omit<MvuSchemaAuthorScript,'imports'>[]
  material:MvuJsonObject
  materialSha256:string
  /** Hash of this complete author descriptor; raw source bytes have their own hash. */
  authorSourceSha256:string
}
export type MvuSchemaAuthorSourceDecision={kind:'author-source';source:MvuSchemaAuthorSource}
  |{kind:'absent'}|{kind:'unsupported';diagnostics:readonly MvuSourceDiagnostic[]}
/** Raw initialization data only. The surrounding author card is a separate
 * schema program, so this descriptor never grants native-json permissions. */
export type MvuSchemaOpeningInitSource=SchemaMvuInitDataSource
export interface MvuSchemaOpeningSource {
  authorSource:MvuSchemaAuthorSource
  initSource:MvuSchemaOpeningInitSource
  freshNativeBasisProof:FreshNativeBasisProof
}
export type MvuSchemaOpeningSourceDecision={kind:'schema-opening-source';source:MvuSchemaOpeningSource}
  |{kind:'absent'}|{kind:'unsupported';diagnostics:readonly MvuSourceDiagnostic[]}

export interface MvuSourceSnapshot {
  schemaVersion: 1
  encoding: 'native-mvu-source-snapshot-v1'
  policy: NativeMvuSourcePolicy
  source: OpeningSource
  pointerSha256: string
  importRecordSha256: string
  coverageSha256: string
  materialRows: readonly MvuSourceRowRef[]
  settings: {
    cards: Readonly<Record<string, string>>
    worldbook: Readonly<Record<string, string>>
    rules: string
    settings: string
    membershipSha256: string
  }
  bindings: {global: readonly []; primary: {pointer: string; sha256: string} | null; additional: readonly []}
  selected: {index: number; pointer: string; sourceSha256: string; renderedSha256: string}
  swipes: readonly {identity: string; index: number; pointer: string; sourceSha256: string; renderedSha256: string}[]
  macroContext: {used: boolean; bindingSha256: string | null; valuesSha256: string | null}
  snapshotSha256: string
}
export interface MvuAbsenceScopeProof {
  schemaVersion: 1
  encoding: 'native-mvu-absence-scope-proof-v1'
  reason: 'closed-native-scope-no-initialization'
  sourceSnapshot: MvuSourceSnapshot
  proofSha256: string
}
export interface FreshNativeBasisFacts {
  schemaVersion: 1
  encoding: 'native-mvu-fresh-basis-facts-v1'
  sessionId: string
  ownerSessionId: string
  branch: {
    metaKey: string; metaSha256: string; inheritance: 'root'; parentSessionId: null
    inheritedPrefixLength: 0; ready: true
  }
  numerical: {
    headKey: string; headExists: false; eventMembershipSha256: string; eventCount: 0; opaqueStateExists: false
  }
  native: {
    observedThroughSeq: number; historyVersionSha256: string; committedOpeningCount: 0; inheritedMessageCount: 0
  }
  basis: {bookStatData: JsonObject; swipes: readonly {identity: string; sourceSha256: string; statData: JsonObject}[]}
}
export interface FreshNativeBasisProof {
  schemaVersion: 1
  encoding: 'native-mvu-fresh-basis-proof-v1'
  sessionId: string
  ownerSessionId: string
  branch: FreshNativeBasisFacts['branch']
  numerical: FreshNativeBasisFacts['numerical']
  native: FreshNativeBasisFacts['native']
  bookStatDataSha256: string
  swipes: readonly {identity: string; sourceSha256: string; statDataSha256: string}[]
  factsSha256: string
  proofSha256: string
}
export interface NativeMvuJsonCandidate {
  schemaVersion: 1
  encoding: 'native-mvu-json-source-candidate-v1'
  policy: NativeMvuSourcePolicy
  sourceSnapshot: MvuSourceSnapshot
  freshNativeBasisProof: FreshNativeBasisProof
  /** These strings are compiler input only; persist the frozen compilation, not this source descriptor. */
  books: readonly {
    identity: string; binding: 'primary'; sourcePointer: string; sourceSha256: string
    entries: readonly {
      identity: string; sourcePointer: string; comment: string; enabled: boolean
      content: string; contentSha256: string; renderedContent: string; renderedContentSha256: string
    }[]
  }[]
  bookStatData: JsonObject
  initializedBooks: readonly []
  messageIndex: 0
  selectedSwipeIdentity: string
  swipes: readonly {
    identity: string; sourcePointer: string; sourceSha256: string; rawOpening: string
    renderedOpening: string; renderedSha256: string; statData: JsonObject
  }[]
  capabilities: {macros: 'none' | 'verified-identity-rendering'; schema: 'json-object-subset-v1'; callbacks: 'none'}
}
export type MvuSourceCode = 'REQUEST_INVALID' | 'SOURCE_INVALID' | 'SOURCE_CHANGED' | 'MATERIAL_INVALID'
  | 'MEMBERSHIP_INVALID' | 'SOURCE_BUDGET' | 'FIELD_UNSUPPORTED' | 'EXTENSION_UNSUPPORTED'
  | 'STATE_SYNTAX_UNSUPPORTED' | 'INITVAR_OUTSIDE_BINDING' | 'INITVAR_INVALID' | 'PRIMARY_REQUIRED'
  | 'MACRO_UNSUPPORTED' | 'BASIS_UNPROVEN' | 'BASIS_INVALID' | 'SNAPSHOT_INVALID'
export interface MvuSourceDiagnostic {code: MvuSourceCode; pointer: string; valueSha256?: string}
export type MvuSourceDecision =
  | {schemaVersion:1; kind:'legacy-v2'; absenceScopeProof:MvuAbsenceScopeProof}
  | {schemaVersion:1; kind:'native-json'; candidate:NativeMvuJsonCandidate}
  | {schemaVersion:1; kind:'unsupported'; diagnostics:readonly MvuSourceDiagnostic[]}
export interface MvuSourceRequest {catalog: OpeningCatalog; candidate: TavernOpeningCandidate}
export interface MvuSourceDeps {
  readActivePointer(sessionId: string): unknown
  readImportRecord(ownerSessionId: string, importId: string): unknown
  readRow(table: MvuSourceTable, key: string): unknown
  recordVersionsFor(sessionId: string): {
    cards: Readonly<Record<string, string>>; worldbook: Readonly<Record<string, string>>; rules: string; settings: string
  }
  /** Actual producer values/binding revision. No client-supplied verified/rendered claim is accepted. */
  readOpeningContext(sessionId: string): {context: TavernOpeningContext; bindingSha256: string}
  readFreshNativeBasis(sessionId: string, swipes: MvuSourceSnapshot['swipes']):
    {kind:'fresh'; facts:FreshNativeBasisFacts} | {kind:'unknown' | 'not-fresh'}
}

class SourceFailure extends Error {
  constructor(readonly diagnostic: MvuSourceDiagnostic) { super(diagnostic.code) }
}
function fail(code: MvuSourceCode, pointer: string, value?: unknown): never {
  throw new SourceFailure({code, pointer, ...(value === undefined ? {} : {valueSha256:recordSha256(value)})})
}
const isObject = (value: unknown): value is JsonObject => !!value && typeof value === 'object' && !Array.isArray(value)
const isHash = (value: unknown): value is string => typeof value === 'string' && hashPattern.test(value)
const isVersion = (value: unknown): value is string => value === 'missing' || isHash(value)
const same = (a: unknown, b: unknown) => recordSha256(a) === recordSha256(b)
const pointerPart = (value: string) => value.replace(/~/g,'~0').replace(/\//g,'~1')
const plainEmpty = (value: unknown) => isObject(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value))
  && Object.keys(value).length === 0
function requireKeys(value: JsonObject, keys: readonly string[], pointer: string, code: MvuSourceCode) {
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(code,pointer, value)
}
function hashMap(value: unknown, pointer: string): Record<string,string> {
  if (!isObject(value) || Object.keys(value).length > MAX_ROWS) fail('MEMBERSHIP_INVALID',pointer)
  const result: Record<string,string> = Object.create(null)
  for (const [key,hash] of Object.entries(value)) {
    if (!idPattern.test(key) || !isHash(hash)) fail('MEMBERSHIP_INVALID',pointer)
    result[key] = hash
  }
  return result
}
function withPolicy(snapshot:MvuSourceSnapshot,policy:NativeMvuSourcePolicy):MvuSourceSnapshot {
  if(same(snapshot.policy,policy))return snapshot
  const {snapshotSha256:_old,...content}=snapshot
  const next={...content,policy}
  return {...next,snapshotSha256:recordSha256(next)}
}

// Whole input walk is bounded and never calls accessors, regexes supplied by the
// author, JS, schema callbacks, loaders or network/model fallbacks.
function boundedData(value: unknown, code: MvuSourceCode, pointer: string, budget = {nodes:0,bytes:0}) {
  const visit = (item: unknown, depth: number) => {
    if (++budget.nodes > 32_000 || depth > 32) fail('SOURCE_BUDGET',pointer)
    if (typeof item === 'string') budget.bytes += Buffer.byteLength(item,'utf8')
    else if (typeof item === 'number') {
      if (!Number.isFinite(item) || Math.abs(item) > Number.MAX_SAFE_INTEGER) fail(code,pointer)
    } else if (item !== null && typeof item !== 'boolean' && typeof item !== 'object') fail(code,pointer)
    if (budget.bytes > MAX_BYTES) fail('SOURCE_BUDGET',pointer)
    if (item && typeof item === 'object') {
      if (Array.isArray(item) && item.length > 4096) fail('SOURCE_BUDGET',pointer)
      if (!Array.isArray(item) && ![Object.prototype,null].includes(Object.getPrototypeOf(item))) fail(code,pointer)
      for (const [key,descriptor] of Object.entries(Object.getOwnPropertyDescriptors(item))) {
        if (Array.isArray(item) && key === 'length') continue
        if (!('value' in descriptor) || ['__proto__','prototype','constructor'].includes(key)) fail(code,pointer)
        budget.bytes += Buffer.byteLength(key,'utf8')
        visit(descriptor.value,depth + 1)
      }
    }
  }
  visit(value,0)
}
function stateSyntax(text: string): boolean {
  return /<script\b|<%|\b(?:registerMvuSchema|getAllVariables|updateVariables|replaceVariables|insertOrAssignVariables)\s*\(/i.test(text)
    || /\b(?:eval|Function|fetch|import|require)\s*\(|\bon[a-z]+\s*=|javascript:|<iframe\b/i.test(text)
    || /<\/?(?:updatevariable|variableupdate|mvu-update)\b|\b_\.(?:get|set|merge|assign|unset)\s*\(/i.test(text)
    || /\b(?:stat_data|mvu_data)\s*(?:[.\[=]|\()/i.test(text)
    || /\{\{\s*(?:getvar|setvar|addvar|incvar|decvar|run|eval|execute|script)\b/i.test(text)
    || /\$(?:meta|schema|template|required|default)\b|VARIABLE_(?:INIT|UPDATE)|MVU_(?:INIT|UPDATE)/.test(text)
}
const initSyntax = (text: string) => /\[initvar\]|<\/?initvar\b/i.test(text)
function render(text: string, context: TavernOpeningContext, requireResolved: boolean): string {
  let cursor = 0, result = ''
  for (;;) {
    const start = text.indexOf('{{',cursor)
    // Closing JSON object braces are data, not an unmatched macro instruction.
    if (start < 0) return result + text.slice(cursor)
    const end = text.indexOf('}}',start + 2)
    if (end < 0) fail('MACRO_UNSUPPORTED','/macros')
    const name = text.slice(start + 2,end)
    if (!['user','char','user_gender'].includes(name) || text[start - 1] === '{' || text[end + 2] === '}') {
      fail('MACRO_UNSUPPORTED','/macros')
    }
    const value = context[name as keyof TavernOpeningContext]
    if (requireResolved && (typeof value !== 'string' || !value || value.length > 512)) fail('MACRO_UNSUPPORTED','/macros')
    result += text.slice(cursor,start) + (typeof value === 'string' && value && value.length <= 512
      ? value : text.slice(start,end + 2))
    cursor = end + 2
  }
}
function openingBlocks(text: string, pointer: string): boolean {
  const tags = /<\/?initvar>/gi
  let open: {start: number; content: number} | null = null, found = false
  for (let tag = tags.exec(text); tag; tag = tags.exec(text)) {
    if (tag[0][1] !== '/') {
      if (open) fail('INITVAR_INVALID',pointer,text)
      open = {start:tag.index,content:tag.index + tag[0].length}
    } else {
      if (!open) fail('INITVAR_INVALID',pointer,text)
      // Classification only locates the declaration. The native-policy compiler
      // owns exact payload capture, strict JSON validation and merge semantics.
      open = null; found = true
    }
  }
  if (open || /<\/?initvar\b/i.test(text) && !found) fail('INITVAR_INVALID',pointer,text)
  return found
}

function extensions(value: unknown, pointer: string, authorSchema=false) {
  if (value === undefined) return
  if (!isObject(value)) fail('EXTENSION_UNSUPPORTED',pointer,value)
  requireKeys(value,['fav','talkativeness','depth_prompt',...(authorSchema?['tavern_helper']:[])],pointer,'EXTENSION_UNSUPPORTED')
  if(authorSchema&&value.tavern_helper!==undefined) {
    if(!isObject(value.tavern_helper))fail('EXTENSION_UNSUPPORTED',pointer)
    // Script effects are preserved in authorSource and admitted by the actual
    // compiler/guest. Unimplemented helper buttons/variables cannot be dropped.
    requireKeys(value.tavern_helper,['scripts'],pointer,'EXTENSION_UNSUPPORTED')
  }
  if (value.fav !== undefined && typeof value.fav !== 'boolean') fail('EXTENSION_UNSUPPORTED',pointer,value)
  if (value.talkativeness !== undefined && (typeof value.talkativeness !== 'number'
    || !Number.isFinite(value.talkativeness))) fail('EXTENSION_UNSUPPORTED',pointer,value)
  if (value.depth_prompt !== undefined) {
    const depth = value.depth_prompt
    if (!isObject(depth)) fail('EXTENSION_UNSUPPORTED',pointer,value)
    requireKeys(depth,['prompt','depth','role'],pointer,'EXTENSION_UNSUPPORTED')
    if (typeof depth.prompt !== 'string' || !Number.isSafeInteger(depth.depth) || Number(depth.depth) < 0
      || !['system','user','assistant'].includes(String(depth.role))) fail('EXTENSION_UNSUPPORTED',pointer,value)
    if (initSyntax(depth.prompt) || stateSyntax(depth.prompt)) fail('STATE_SYNTAX_UNSUPPORTED',pointer,value)
  }
}

interface Captured {
  snapshot: MvuSourceSnapshot
  document: JsonObject
  data: JsonObject
  context: TavernOpeningContext
  candidates: TavernOpeningCandidate[]
  rows: readonly {ref: MvuSourceRowRef; value: unknown}[]
  activationRows: ReadonlySet<string>
}
/** Core owns the existing source/import lock. All reads are synchronous; this
 * module neither acquires a second lock nor writes any Domain/native record. */
export function createRoleplayMvuSource(deps: MvuSourceDeps) {
  const capture = (sessionId: string, selectedIndex: number): Captured => {
    if (!idPattern.test(sessionId) || !Number.isSafeInteger(selectedIndex) || selectedIndex < 0) fail('REQUEST_INVALID','')
    const pointer = deps.readActivePointer(sessionId) as ImportPointer | undefined
    if (!pointer || !idPattern.test(pointer.importId) || !isHash(pointer.normalizedSha256)
      || !isHash(pointer.coverageSha256) || typeof pointer.transactionId !== 'string') fail('SOURCE_INVALID','/source')
    requireKeys(pointer as unknown as JsonObject,['importId','sourceRecordSessionId','normalizedSha256',
      'transactionId','coverageSha256','activatedAt'],'/source','SOURCE_INVALID')
    if (!idPattern.test(pointer.transactionId)) fail('SOURCE_INVALID','/source')
    const owner = pointer.sourceRecordSessionId ?? sessionId
    if (!idPattern.test(owner)) fail('SOURCE_INVALID','/source')
    const record = deps.readImportRecord(owner,pointer.importId) as ImportRecord | undefined
    if (!record || ![4,5].includes(record.schemaVersion) || record.status !== 'active'
      || record.sessionId !== owner || record.importId !== pointer.importId
      || record.normalizedSha256 !== pointer.normalizedSha256 || record.activation?.transactionId !== pointer.transactionId) {
      fail('SOURCE_INVALID','/source')
    }
    try { assertImportRecordIntegrity(record) } catch { fail('SOURCE_INVALID','/source') }
    const coverage = importCoverage(record)
    if (coverage.coverage !== 1 || coverage.uncovered.length || coverage.overlaps.length
      || recordSha256(coverage) !== pointer.coverageSha256) fail('SOURCE_INVALID','/source/coverage')
    const rows: {ref:MvuSourceRowRef; value:unknown}[] = []
    const budget = {nodes:0,bytes:0}
    const seen = new Set<string>()
    const read = (table: MvuSourceTable, key: string, expected?: string) => {
      if (!keyPattern.test(key) || !key.startsWith(`${sessionId}__`) || rows.length >= MAX_ROWS) fail('MATERIAL_INVALID','/material')
      const id = `${table}:${key}`
      const value = deps.readRow(table,key)
      if (value !== undefined && !isObject(value)) fail('FIELD_UNSUPPORTED','/settings')
      if (!seen.has(id)) boundedData(value ?? null,'FIELD_UNSUPPORTED','/settings',budget)
      const ref = {table,key,exists:value !== undefined,sha256:recordSha256(value)}
      if (expected !== undefined && (!ref.exists || ref.sha256 !== expected)) fail('MATERIAL_INVALID','/material')
      if (!seen.has(id)) {rows.push({ref,value}); seen.add(id)}
      return ref
    }
    const digests = record.activation!.writeDigests
    const activationRows = new Set<string>()
    if (!Array.isArray(digests) || !digests.length || digests.length > MAX_ROWS) fail('MATERIAL_INVALID','/material')
    for (const digest of digests) {
      if (!digest || !['branch','cards','worldbook','rules','status','opening'].includes(digest.tableName)
        || !isHash(digest.sha256)) fail('MATERIAL_INVALID','/material')
      read(digest.tableName as MvuSourceTable,digest.key,digest.sha256)
      activationRows.add(`${digest.tableName}:${digest.key}`)
    }
    const versions = deps.recordVersionsFor(sessionId)
    const cards = hashMap(versions.cards,'/settings/cards'), worldbook = hashMap(versions.worldbook,'/settings/worldbook')
    if (!isVersion(versions.rules) || !isVersion(versions.settings)) fail('MEMBERSHIP_INVALID','/settings')
    for (const [id,expected] of Object.entries(cards)) read('cards',`${sessionId}__${id}`,expected)
    for (const [id,expected] of Object.entries(worldbook)) read('worldbook',`${sessionId}__${id}`,expected)
    const rules = read('rules',`${sessionId}__spec`), settings = read('branch',`${sessionId}__settings`)
    if (rules.sha256 !== versions.rules || settings.sha256 !== versions.settings) fail('MEMBERSHIP_INVALID','/settings')
    // A source rule added after import must invalidate even an originally absent
    // record. These are author inputs, unlike dynamic panel/init-head/event output.
    read('status',`${sessionId}__spec`)
    read('opening',`${sessionId}__scene`)
    const context = deps.readOpeningContext(sessionId)
    if (!context || !isObject(context.context) || !isHash(context.bindingSha256)) fail('MACRO_UNSUPPORTED','/macros')
    requireKeys(context.context as JsonObject,['user','char','user_gender'],'/macros','MACRO_UNSUPPORTED')
    for (const value of Object.values(context.context)) {
      if (typeof value !== 'string' || value.length > 512) fail('MACRO_UNSUPPORTED','/macros')
    }
    const envelope = record.sourceEnvelope!
    const decoded = decodeTavernCard(Buffer.from(envelope.base64,'base64'),envelope.extension)
    boundedData(decoded.document,'FIELD_UNSUPPORTED','/document',budget)
    const candidates = compileTavernOpeningCandidates(decoded,context.context)
    const selected = candidates.find(item => item.index === selectedIndex)
    if (!selected) fail('REQUEST_INVALID','/selected')
    const source: OpeningSource = {sessionId,importId:pointer.importId,sourceRecordSessionId:owner,
      rawSha256:record.rawSha256,normalizedSha256:record.normalizedSha256,transactionId:pointer.transactionId!,
      coverageSha256:pointer.coverageSha256!,pointer:{...pointer}}
    const root = decoded.document.data === decoded.data ? '/data' : ''
    const used = JSON.stringify(decoded.document).includes('{{')
      || rows.some(item => JSON.stringify(item.value ?? null).includes('{{'))
    const membership = {cards,worldbook,rules:versions.rules,settings:versions.settings}
    const content = {
      schemaVersion:1 as const,encoding:'native-mvu-source-snapshot-v1' as const,policy:NATIVE_MVU_SOURCE_POLICY,
      source,pointerSha256:recordSha256(pointer),importRecordSha256:recordSha256(record),coverageSha256:recordSha256(coverage),
      materialRows:rows.map(item => item.ref).sort((a,b) => {
        const left = `${a.table}:${a.key}`, right = `${b.table}:${b.key}`
        return left < right ? -1 : left > right ? 1 : 0
      }),
      settings:{...membership,membershipSha256:recordSha256(membership)},
      bindings:{global:[] as [],primary:decoded.data.character_book === undefined ? null
        : {pointer:`${root}/character_book`,sha256:recordSha256(decoded.data.character_book)},additional:[] as []},
      selected:{index:selected.index,pointer:selected.sourcePointer,sourceSha256:selected.sourceSha256,
        renderedSha256:sha(selected.renderedText)},
      swipes:candidates.map(item => ({identity:`swipe-${item.index}`,index:item.index,pointer:item.sourcePointer,
        sourceSha256:item.sourceSha256,renderedSha256:sha(item.renderedText)})),
      macroContext:{used,bindingSha256:used ? context.bindingSha256 : null,valuesSha256:used ? recordSha256(context.context) : null},
    }
    return {snapshot:{...content,snapshotSha256:recordSha256(content)},document:decoded.document,
      data:decoded.data,context:context.context,candidates,rows,activationRows}
  }

  const classify = (captured: Captured, authorSchema=false) => {
    const {data,context,snapshot} = captured
    if (captured.document !== data) requireKeys(captured.document,['spec','spec_version','data'],'/document','FIELD_UNSUPPORTED')
    requireKeys(data,['name','description','personality','scenario','first_mes','mes_example','system_prompt',
      'post_history_instructions','creator_notes','tags','creator','character_version','alternate_greetings',
      'extensions','character_book'],'/data','FIELD_UNSUPPORTED')
    extensions(data.extensions,'/data/extensions',authorSchema)
    const depthPrompt = (data.extensions as JsonObject | undefined)?.depth_prompt as JsonObject | undefined
    if (depthPrompt) render(depthPrompt.prompt as string,context,false)
    for (const [key,value] of Object.entries(data)) {
      if (['extensions','character_book','first_mes','alternate_greetings'].includes(key)) continue
      if (key === 'tags' ? !Array.isArray(value) || value.some(item => typeof item !== 'string') : typeof value !== 'string') {
        fail('FIELD_UNSUPPORTED',`/data/${pointerPart(key)}`,value)
      }
      for (const text of typeof value === 'string' ? [value] : value as string[]) {
        if (stateSyntax(text) || initSyntax(text)) fail('STATE_SYNTAX_UNSUPPORTED',`/data/${pointerPart(key)}`,text)
        render(text,context,false)
      }
    }
    const book = data.character_book
    const entries: NativeMvuJsonCandidate['books'][number]['entries'][number][] = []
    if (book !== undefined) {
      if (!isObject(book) || !Array.isArray(book.entries)) fail('FIELD_UNSUPPORTED','/data/character_book',book)
      requireKeys(book,['name','description','entries','extensions','scan_depth','token_budget','recursive_scanning'],
        '/data/character_book','FIELD_UNSUPPORTED')
      if (book.extensions !== undefined && !plainEmpty(book.extensions)) fail('EXTENSION_UNSUPPORTED','/data/character_book/extensions')
      for (const key of ['name','description']) if (book[key] !== undefined && typeof book[key] !== 'string') {
        fail('FIELD_UNSUPPORTED','/data/character_book')
      }
      for (const key of ['name','description']) if (typeof book[key] === 'string'
        && (stateSyntax(book[key]) || initSyntax(book[key]))) fail('STATE_SYNTAX_UNSUPPORTED','/data/character_book')
      for (const key of ['scan_depth','token_budget']) if (book[key] !== undefined
        && (!Number.isSafeInteger(book[key]) || Number(book[key]) < 0)) fail('FIELD_UNSUPPORTED','/data/character_book')
      if (book.recursive_scanning !== undefined && typeof book.recursive_scanning !== 'boolean') {
        fail('FIELD_UNSUPPORTED','/data/character_book')
      }
      for (const [index,raw] of book.entries.entries()) {
        const pointer = `${snapshot.bindings.primary!.pointer}/entries/${index}`
        if (!isObject(raw) || typeof raw.content !== 'string' || raw.comment !== undefined && typeof raw.comment !== 'string') {
          fail('FIELD_UNSUPPORTED',pointer)
        }
        requireKeys(raw,['id','name','comment','content','keys','key','secondary_keys','keysecondary','enabled','disable',
          'constant','selective','case_sensitive','use_regex','insertion_order','order','position','extensions'],pointer,'FIELD_UNSUPPORTED')
        if (raw.extensions !== undefined && !plainEmpty(raw.extensions)) fail('EXTENSION_UNSUPPORTED',pointer)
        for (const key of ['enabled','disable','constant','selective','case_sensitive','use_regex']) {
          if (raw[key] !== undefined && typeof raw[key] !== 'boolean') fail('FIELD_UNSUPPORTED',pointer)
        }
        for (const key of ['keys','key','secondary_keys','keysecondary']) if (raw[key] !== undefined
          && (!Array.isArray(raw[key]) || (raw[key] as unknown[]).some(item => typeof item !== 'string'))) {
          fail('FIELD_UNSUPPORTED',pointer)
        }
        for (const key of ['name','position']) if (raw[key] !== undefined && typeof raw[key] !== 'string') {
          fail('FIELD_UNSUPPORTED',pointer)
        }
        if (raw.id !== undefined && typeof raw.id !== 'string' && typeof raw.id !== 'number') fail('FIELD_UNSUPPORTED',pointer)
        for (const key of ['insertion_order','order']) if (raw[key] !== undefined
          && (typeof raw[key] !== 'number' || !Number.isFinite(raw[key]))) fail('FIELD_UNSUPPORTED',pointer)
        if ([raw.content,raw.comment,raw.name].some(value => typeof value === 'string' && stateSyntax(value))) {
          fail('STATE_SYNTAX_UNSUPPORTED',pointer)
        }
        const comment = String(raw.comment ?? '')
        const isInit = comment.toLowerCase().includes('[initvar]')
        if (!isInit && initSyntax(raw.content)) fail('INITVAR_OUTSIDE_BINDING',pointer,raw.content)
        const rendered = render(raw.content,context,isInit)
        if (isInit) {
          entries.push({identity:`entry-${index}`,sourcePointer:pointer,comment,
            enabled:raw.enabled !== false && raw.disable !== true,content:raw.content,contentSha256:sha(raw.content),
            renderedContent:rendered,renderedContentSha256:sha(rendered)})
        }
      }
    }
    let openingInit = false
    for (const candidate of captured.candidates) {
      if (stateSyntax(candidate.rawText)) fail('STATE_SYNTAX_UNSUPPORTED',candidate.sourcePointer,candidate.rawText)
      if (openingBlocks(candidate.renderedText,candidate.sourcePointer)) openingInit = true
      render(candidate.rawText,context,entries.length > 0 || openingInit)
    }
    // Import projection can move a constant InitVar payload into rules. Its
    // immutable activation digest authorizes those original rows only; unrelated
    // session records carrying initialization declarations cannot be ignored.
    const primaryRows = captured.activationRows
    for (const {ref,value} of captured.rows) {
      boundedData(value ?? null,'FIELD_UNSUPPORTED','/settings')
      const texts: string[] = []
      const walk = (item: unknown) => {
        if (typeof item === 'string') texts.push(item)
        else if (item && typeof item === 'object') for (const [key,child] of Object.entries(item)) {
          if (/^(?:stat_data|statData|mvu_data|mvu|state|opaqueState|variables|schema|scripts?|callbacks?)$/i.test(key)
            || /^(?:card_agent|chaoshen_jixieshi|risuai)$/.test(key)
            || key.startsWith('$')) fail('STATE_SYNTAX_UNSUPPORTED','/settings')
          if(authorSchema&&key==='tavern_helper'&&isObject(data.extensions)
            &&same(child,data.extensions.tavern_helper))continue
          if (key === 'extensions') extensions(child,'/settings/extensions',authorSchema)
          walk(child)
        }
      }
      walk(value)
      for (const text of texts) {
        if (stateSyntax(text)) fail('STATE_SYNTAX_UNSUPPORTED','/settings',text)
        render(text,context,false)
        if (initSyntax(text) && !primaryRows.has(`${ref.table}:${ref.key}`)) fail('INITVAR_OUTSIDE_BINDING','/settings',text)
      }
    }
    const selection=selectNativeMvuInitializationPolicy({books:[{entries}],
      swipes:captured.candidates.map(item=>({rawOpening:item.rawText,renderedOpening:item.renderedText}))})
    if(selection.kind==='unsupported')fail('INITVAR_INVALID',selection.diagnostics[0]!.pointer)
    return {entries,hasInit:entries.length > 0 || openingInit,policy:selection.policy}
  }

  const fresh = (snapshot: MvuSourceSnapshot): {proof:FreshNativeBasisProof; facts:FreshNativeBasisFacts} => {
    const observed = deps.readFreshNativeBasis(snapshot.source.sessionId,snapshot.swipes)
    if (!observed || observed.kind !== 'fresh') fail('BASIS_UNPROVEN','/basis')
    const facts = observed.facts
    boundedData(facts,'BASIS_INVALID','/basis')
    if (!isObject(facts)) fail('BASIS_INVALID','/basis')
    requireKeys(facts as unknown as JsonObject,
      ['schemaVersion','encoding','sessionId','ownerSessionId','branch','numerical','native','basis'],'/basis','BASIS_INVALID')
    for (const [value,keys] of [
      [facts.branch,['metaKey','metaSha256','inheritance','parentSessionId','inheritedPrefixLength','ready']],
      [facts.numerical,['headKey','headExists','eventMembershipSha256','eventCount','opaqueStateExists']],
      [facts.native,['observedThroughSeq','historyVersionSha256','committedOpeningCount','inheritedMessageCount']],
      [facts.basis,['bookStatData','swipes']],
    ] as const) {
      if (!isObject(value)) fail('BASIS_INVALID','/basis')
      requireKeys(value as unknown as JsonObject,keys,'/basis','BASIS_INVALID')
    }
    if (!facts || facts.schemaVersion !== 1 || facts.encoding !== 'native-mvu-fresh-basis-facts-v1'
      || facts.sessionId !== snapshot.source.sessionId || facts.ownerSessionId !== facts.sessionId
      || facts.branch?.metaKey !== `${facts.sessionId}__meta` || !isHash(facts.branch.metaSha256)
      || facts.branch.inheritance !== 'root' || facts.branch.parentSessionId !== null
      || facts.branch.inheritedPrefixLength !== 0 || facts.branch.ready !== true
      || facts.numerical?.headExists !== false || facts.numerical.eventCount !== 0 || facts.numerical.opaqueStateExists !== false
      || !idPattern.test(facts.numerical.headKey) || !facts.numerical.headKey.startsWith(`${facts.sessionId}__`)
      || !isHash(facts.numerical.eventMembershipSha256) || !isHash(facts.native?.historyVersionSha256)
      || !Number.isSafeInteger(facts.native.observedThroughSeq) || facts.native.observedThroughSeq < -1
      || facts.native.committedOpeningCount !== 0 || facts.native.inheritedMessageCount !== 0
      || !plainEmpty(facts.basis?.bookStatData) || !Array.isArray(facts.basis.swipes)
      || facts.basis.swipes.length !== snapshot.swipes.length) fail('BASIS_INVALID','/basis')
    const actualMeta = deps.readRow('branch',facts.branch.metaKey)
    if (actualMeta === undefined || recordSha256(actualMeta) !== facts.branch.metaSha256
      || deps.readRow('status',facts.numerical.headKey) !== undefined) fail('BASIS_INVALID','/basis')
    for (const [index,swipe] of facts.basis.swipes.entries()) {
      const source = snapshot.swipes[index]!
      requireKeys(swipe as unknown as JsonObject,['identity','sourceSha256','statData'],'/basis/swipes','BASIS_INVALID')
      if (swipe.identity !== source.identity || swipe.sourceSha256 !== source.sourceSha256 || !plainEmpty(swipe.statData)) {
        fail('BASIS_INVALID','/basis/swipes')
      }
    }
    const content = {schemaVersion:1 as const,encoding:'native-mvu-fresh-basis-proof-v1' as const,
      sessionId:facts.sessionId,ownerSessionId:facts.ownerSessionId,branch:structuredClone(facts.branch),
      numerical:structuredClone(facts.numerical),native:structuredClone(facts.native),
      bookStatDataSha256:recordSha256(facts.basis.bookStatData),
      swipes:facts.basis.swipes.map(item => ({identity:item.identity,sourceSha256:item.sourceSha256,
        statDataSha256:recordSha256(item.statData)})),factsSha256:recordSha256(facts)}
    return {proof:{...content,proofSha256:recordSha256(content)},facts}
  }
  const produce = (request: MvuSourceRequest): MvuSourceDecision => {
    try {
      if (!isObject(request)) fail('REQUEST_INVALID','')
      boundedData(request,'REQUEST_INVALID','')
      requireKeys(request as unknown as JsonObject,['catalog','candidate'],'','REQUEST_INVALID')
      const captured = capture(request.catalog.source.sessionId,request.candidate.index)
      const selected = captured.candidates.find(item => item.index === request.candidate.index)!
      if (!same(captured.snapshot.source,request.catalog.source) || !same(captured.candidates,request.catalog.candidates)
        || !same(selected,request.candidate)) fail('SOURCE_CHANGED','/selected')
      const {entries,hasInit,policy} = classify(captured)
      const snapshot = withPolicy(captured.snapshot,policy)
      if (!hasInit) {
        const proof = {schemaVersion:1 as const,encoding:'native-mvu-absence-scope-proof-v1' as const,
          reason:'closed-native-scope-no-initialization' as const,sourceSnapshot:snapshot}
        return {schemaVersion:1,kind:'legacy-v2',absenceScopeProof:{...proof,proofSha256:recordSha256(proof)}}
      }
      if (!snapshot.bindings.primary || !entries.length) fail('PRIMARY_REQUIRED','/bindings/primary')
      const {proof,facts} = fresh(snapshot)
      return {schemaVersion:1,kind:'native-json',candidate:{schemaVersion:1,encoding:'native-mvu-json-source-candidate-v1',
        policy,sourceSnapshot:snapshot,freshNativeBasisProof:proof,
        books:[{identity:'embedded-primary',binding:'primary',sourcePointer:snapshot.bindings.primary.pointer,
          sourceSha256:snapshot.bindings.primary.sha256,entries}],bookStatData:structuredClone(facts.basis.bookStatData),
        initializedBooks:[],messageIndex:0,selectedSwipeIdentity:`swipe-${request.candidate.index}`,
        swipes:captured.candidates.map((item,index) => ({identity:`swipe-${item.index}`,sourcePointer:item.sourcePointer,
          sourceSha256:item.sourceSha256,rawOpening:item.rawText,renderedOpening:item.renderedText,
          renderedSha256:sha(item.renderedText),statData:structuredClone(facts.basis.swipes[index]!.statData)})),
        capabilities:{macros:snapshot.macroContext.used ? 'verified-identity-rendering' : 'none',
          schema:'json-object-subset-v1',callbacks:'none'}}}
    } catch (error) {
      return {schemaVersion:1,kind:'unsupported',diagnostics:[error instanceof SourceFailure
        ? error.diagnostic : {code:'SOURCE_INVALID',pointer:'/source'}]}
    }
  }
  const current = (snapshot: MvuSourceSnapshot): boolean => {
    try {
      boundedData(snapshot,'SNAPSHOT_INVALID','/snapshot')
      const {snapshotSha256,...content} = snapshot
      if (!isHash(snapshotSha256) || recordSha256(content) !== snapshotSha256
        || !isNativeMvuSourcePolicy(snapshot.policy)) return false
      // Re-read the whole declared scope, including membership. Do not compare
      // memory/native history/numerical head: our own successful publication must
      // not invalidate an input-source snapshot. Fresh basis has a separate owner.
      const actual=capture(snapshot.source.sessionId,snapshot.selected.index)
      return same(snapshot,withPolicy(actual.snapshot,classify(actual).policy))
    } catch { return false }
  }
  function authorSourceOf(captured:Captured):MvuSchemaAuthorSourceDecision {
    try {
      const extension=captured.data.extensions
      if(extension===undefined)return {kind:'absent'}
      if(!isObject(extension))fail('EXTENSION_UNSUPPORTED','/extensions')
      const helper=extension.tavern_helper
      if(helper===undefined)return {kind:'absent'}
      if(!isObject(helper))fail('EXTENSION_UNSUPPORTED','/extensions/tavern_helper')
      if(helper.scripts===undefined)return {kind:'absent'}
      if(!Array.isArray(helper.scripts)||helper.scripts.length>64) {
        fail('FIELD_UNSUPPORTED','/extensions/tavern_helper/scripts')
      }
      const root=captured.document.data===captured.data?'/data':''
      const scripts=helper.scripts.map((raw,index)=>{
        const pointer=`${root}/extensions/tavern_helper/scripts/${index}`
        // Preserve every entry and its explicit enable state in original order.
        // Selecting only apparent schema calls would silently discard other
        // author effects. Unknown active code is the compiler's explicit refusal.
        if(!isObject(raw)||raw.type!=='script'||typeof raw.enabled!=='boolean'||typeof raw.content!=='string') {
          fail('FIELD_UNSUPPORTED',pointer)
        }
        return {identity:`script-${index}`,pointer,enabled:raw.enabled,source:raw.content,
          sourceSha256:schemaTextSha256(raw.content)}
      })
      if(!scripts.length)return {kind:'absent'}
      const {policy:_policy,encoding:_encoding,snapshotSha256:_sha,...scope}=captured.snapshot
      const snapshotBody={...scope,encoding:'native-mvu-author-source-snapshot-v1' as const,
        documentSha256:recordSha256(captured.document)}
      const snapshot={...snapshotBody,snapshotSha256:recordSha256(snapshotBody)}
      const material=cloneSchemaData({card:captured.document,
        rows:captured.rows.map(({ref,value})=>({table:ref.table,key:ref.key,exists:ref.exists,value:value??null})),
        openingContext:captured.context},4*MAX_BYTES) as unknown as MvuJsonObject
      const body={schemaVersion:1 as const,encoding:'native-mvu-author-source-v1' as const,
        snapshot,scripts,material,materialSha256:recordSha256(material)}
      return {kind:'author-source',source:cloneSchemaData({...body,authorSourceSha256:recordSha256(body)},8*MAX_BYTES)}
    } catch(error) {
      return {kind:'unsupported',diagnostics:[error instanceof SourceFailure
        ?error.diagnostic:{code:'SOURCE_INVALID',pointer:'/source'}]}
    }
  }
  function readAuthorSource(sessionId:string,selectedIndex:number):MvuSchemaAuthorSourceDecision {
    try {return authorSourceOf(capture(sessionId,selectedIndex))}
    catch(error) {return {kind:'unsupported',diagnostics:[error instanceof SourceFailure
      ?error.diagnostic:{code:'SOURCE_INVALID',pointer:'/source'}]}}
  }
  function schemaOpeningData(captured:Captured) {
    const author=authorSourceOf(captured)
    if(author.kind!=='author-source')return author
    if(!author.source.scripts.some(script=>script.enabled))return {kind:'absent' as const}
    const {entries,policy}=classify(captured,true)
    const primary=captured.snapshot.bindings.primary
    const body={schemaVersion:1 as const,encoding:'native-mvu-schema-opening-init-source-v1' as const,
      grammar:isNativeMvuYamlSourcePolicy(policy)?'yaml-1.2-json-data-v1' as const:'strict-json-object-v1' as const,
      books:primary?[{identity:'embedded-primary',binding:'primary' as const,sourcePointer:primary.pointer,
        sourceSha256:primary.sha256,entries}]:[],
      bookStatData:{},initializedBooks:[] as [],messageIndex:0 as const,
      selectedSwipeIdentity:`swipe-${captured.snapshot.selected.index}`,
      swipes:captured.candidates.map(item=>({identity:`swipe-${item.index}`,sourcePointer:item.sourcePointer,
        sourceSha256:item.sourceSha256,rawOpening:item.rawText,renderedOpening:item.renderedText,
        renderedSha256:sha(item.renderedText),statData:{}})),
      macros:captured.snapshot.macroContext.used?'verified-identity-rendering' as const:'none' as const}
    const initSource:MvuSchemaOpeningInitSource={...body,initSourceSha256:recordSha256(body)}
    return {kind:'schema-opening-data' as const,authorSource:author.source,initSource}
  }
  function readSchemaOpeningSource(request:MvuSourceRequest):MvuSchemaOpeningSourceDecision {
    try {
      const captured=capture(request.catalog.source.sessionId,request.candidate.index)
      if(!same(captured.snapshot.source,request.catalog.source)||!same(captured.candidates,request.catalog.candidates)
        ||!same(captured.candidates.find(item=>item.index===request.candidate.index),request.candidate)) {
        fail('SOURCE_CHANGED','/selected')
      }
      const data=schemaOpeningData(captured)
      if(data.kind!=='schema-opening-data')return data
      const {proof}=fresh(captured.snapshot)
      return {kind:'schema-opening-source',source:{authorSource:data.authorSource,initSource:data.initSource,
        freshNativeBasisProof:proof}}
    } catch(error) {return {kind:'unsupported',diagnostics:[error instanceof SourceFailure
      ?error.diagnostic:{code:'SOURCE_INVALID',pointer:'/source'}]}}
  }
  function schemaOpeningSourceCurrent(expected:{authorSourceSha256:string;
    sourceSnapshot:MvuSchemaAuthorSource['snapshot'];initSource:MvuSchemaOpeningInitSource}):boolean {
    try {
      // Do not recapture an empty basis after our own dispatch/opening writes.
      // Original fresh-basis and current Native publication have distinct owners.
      const data=schemaOpeningData(capture(expected.sourceSnapshot.source.sessionId,expected.sourceSnapshot.selected.index))
      return data.kind==='schema-opening-data'&&data.authorSource.authorSourceSha256===expected.authorSourceSha256
        &&same(data.authorSource.snapshot,expected.sourceSnapshot)&&same(data.initSource,expected.initSource)
    } catch {return false}
  }
  function authorSourceCurrent(expected:MvuSchemaAuthorSource):boolean {
    try {
      const saved=cloneSchemaData(expected,8*MAX_BYTES)
      const actual=readAuthorSource(saved.snapshot.source.sessionId,saved.snapshot.selected.index)
      return actual.kind==='author-source'&&same(saved,actual.source)
    } catch {return false}
  }
  return {produce,current,readAuthorSource,authorSourceCurrent,readSchemaOpeningSource,schemaOpeningSourceCurrent}
}
