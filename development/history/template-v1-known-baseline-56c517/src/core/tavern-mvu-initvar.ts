import {createHash} from 'node:crypto'
import {NATIVE_MVU_SOURCE_POLICY,NATIVE_MVU_YAML_SOURCE_POLICY,isNativeMvuSourcePolicy,
  isNativeMvuYamlSourcePolicy,nativeMvuPayloadGrammar} from './roleplay-mvu-source-policy.js'
import type {NativeMvuSourcePolicy} from './roleplay-mvu-source-policy.js'
import type {NativeMvuJsonCandidate} from './roleplay-mvu-source.js'
import {parseMvuYamlData} from './tavern-mvu-yaml.js'
import {parseMvuUpdateV2} from './roleplay-mvu-update-v2.js'
import type {ParsedMvuUpdateV2} from './roleplay-mvu-update-v2.js'

export type MvuJsonValue = null | boolean | number | string | MvuJsonValue[] | MvuJsonObject
export interface MvuJsonObject { [key: string]: MvuJsonValue }
export type MvuInitDialect = 'A' | 'B' | 'D'

export interface MvuInitSourceIdentity {
  verified: true
  sourceId: string
  sourceSha256: string
  dialect: MvuInitDialect
  dialectSha256: string
  commit?: string
  loader: {
    selection: 'observed-exact' | 'declared-single-exact' | 'unknown'
    candidateCount: number
    enabled: boolean
    preferred: boolean
  }
  /** Provenance is separate from original module settlement; compilation cannot attest settlement. */
  originalLoaderSettlement: 'not-proven' | 'proven'
}

export interface MvuInitRenderedPayload {
  capability: 'server-verified'
  /** Hash of the extracted payload before expansion, not the whole entry/opening. */
  sourceSha256: string
  text: string
}

export interface MvuInitBookEntry {
  identity: string
  comment: string
  enabled: boolean
  content: string
  rendered?: MvuInitRenderedPayload
}

export interface MvuInitBook {
  identity: string
  binding: 'global' | 'primary' | 'additional'
  sourceSha256: string
  entries: readonly MvuInitBookEntry[]
}

export interface MvuInitSwipe {
  identity: string
  sourceSha256: string
  rawOpening: string
  materialization?:'template'|'materialized'
  /** Explicit observed swipe baseline; a new swipe uses an explicitly supplied empty object. */
  statData: MvuJsonObject
  statDataSha256: string
  renderedBlocks?: readonly MvuInitRenderedPayload[]
}

export interface MvuInitSourceInput {
  /** Trusted Core producer contract only; these flags are never client authorization. */
  schemaVersion: 1
  source: MvuInitSourceIdentity
  /** Actual returned order: globals, primary (at most one), then additional books. */
  books: readonly MvuInitBook[]
  bookStatData: MvuJsonObject
  bookStatDataSha256: string
  initializedBooks: readonly string[]
  messageIndex: 0
  swipes: readonly MvuInitSwipe[]
  selectedSwipeIdentity: string
  capabilities: {
    macros: 'none' | 'verified-rendered' | 'unsupported'
    schema: 'json-object-subset-v1' | 'unsupported'
    callbacks: 'none' | 'unsupported'
    openingUpdates: 'none' | 'unsupported'
  }
}

type MvuCalculationInput = Omit<MvuInitSourceInput, 'schemaVersion' | 'source'>

/** Program selection is distinct from an observed or declared original author loader. */
export interface NativeMvuInitSourceIdentity {
  authority: 'core-native-policy'
  sourceId: string
  sourceSha256: string
  policy: NativeMvuSourcePolicy
  originalLoaderSettlement: 'not-proven'
}
export interface NativeMvuInitPlan extends Omit<MvuInitPlan, 'schemaVersion' | 'source' | 'policy' | 'capability'> {
  schemaVersion: 2
  source: NativeMvuInitSourceIdentity
  policy:'strict-json-object-v1'|'yaml-1.2-json-data-v1'
  capability:'native-json-data-only'|'native-json-yaml-data-only'
}
export type NativeMvuInitCompileResult =
  | {schemaVersion: 2; kind: 'supported'; plan: NativeMvuInitPlan}
  | {schemaVersion: 2; kind: 'unsupported'; inputHash?: string; diagnostics: MvuInitDiagnostic[]}

/** Raw initialization data only. This descriptor does not claim that its card,
 * author schema, callbacks or loader are supported, nor grant publication. */
export interface SchemaMvuInitDataSource {
  schemaVersion: 1
  encoding: 'native-mvu-schema-opening-init-source-v1'
  grammar: 'strict-json-object-v1' | 'yaml-1.2-json-data-v1'
  books: NativeMvuJsonCandidate['books']
  bookStatData: MvuJsonObject
  initializedBooks: readonly []
  messageIndex: 0
  selectedSwipeIdentity: string
  swipes: NativeMvuJsonCandidate['swipes']
  macros: 'none' | 'verified-identity-rendering'
  initSourceSha256: string
}
export interface SchemaMvuInitDataSourceV2 extends Omit<SchemaMvuInitDataSource,'schemaVersion'|'encoding'> {
  schemaVersion:2
  encoding:'native-mvu-schema-opening-init-source-v2'
}
export type SchemaMvuInitDataResult =
  | {kind: 'parsed'; values: MvuJsonObject; valuesSha256: string; context: MvuJsonObject;
      baseline: MvuInitStateResult; swipes: MvuInitSwipePlan[]; initSourceSha256: string;
      openingUpdate?:ParsedMvuUpdateV2}
  | {kind: 'unsupported'; diagnostics: MvuInitDiagnostic[]; inputHash?: string}

export interface MvuInitBounds {
  inputBytes: 1048576
  outputBytes: 1048576
  depth: 32
  /** Descriptor/plan wrappers do not consume the JSON data depth allowance. */
  descriptorDepth: 48
  nodes: 32000
  arrayLength: 4096
  numberMagnitude: 9007199254740991
}

export interface MvuInitEntryStep {
  identity: string
  contentSha256: string
  payloadSha256: string
  renderedSha256: string
  dataSha256: string
}

export interface MvuInitBookStep {
  identity: string
  binding: MvuInitBook['binding']
  sourceSha256: string
  status: 'already-initialized' | 'loaded'
  entries: MvuInitEntryStep[]
  resultSha256: string
}

export interface MvuInitStateResult {
  statData: MvuJsonObject
  dataSha256: string
  initializedBooks: string[]
  books: MvuInitBookStep[]
}

export interface MvuInitSwipePlan extends MvuInitStateResult {
  identity: string
  sourceSha256: string
  replaced: boolean
  blocks: {payloadSha256: string; renderedSha256: string; dataSha256: string}[]
}

export interface MvuInitPlan {
  schemaVersion: 1
  policy: 'strict-json-object-v1'
  source: MvuInitSourceIdentity
  staticSourceVersion: {dialect: MvuInitDialect; sha256: string; commit?: string}
  /** Author schema/defaults, callbacks and update interpreters are outside this data subset. */
  capability: 'native-json-data-only'
  assurance: 'supported-static'
  bounds: MvuInitBounds
  inputHash: string
  basis: MvuInitBasis
  basisHash: string
  selectedSwipeIdentity: string
  baseline: MvuInitStateResult
  swipes: MvuInitSwipePlan[]
  /** SHA256 of canonical JSON of the complete plan excluding this property. */
  planHash: string
}

export interface MvuInitDiagnostic {code: string; pointer: string}
export interface MvuInitBasis {
  bookStatData: MvuJsonObject
  bookStatDataSha256: string
  initializedBooks: string[]
  selectedSwipeIdentity: string
  swipes: {identity: string; sourceSha256: string; statData: MvuJsonObject; statDataSha256: string}[]
}
export interface MvuInitUnverifiedIdentity {
  sourceId?: string
  sourceSha256?: string
  dialect?: string
  dialectSha256?: string
  commit?: string
}
export type MvuInitCompileResult =
  | {schemaVersion: 1; kind: 'none'; source: MvuInitSourceIdentity; inputHash: string;
      basis: MvuInitBasis; basisHash: string;
      reason: 'loader-disabled' | 'loader-not-preferred' | 'no-new-book'}
  | {schemaVersion: 1; kind: 'supported'; plan: MvuInitPlan}
  | {schemaVersion: 1; kind: 'unsupported'; source: MvuInitUnverifiedIdentity | null;
      diagnostics: MvuInitDiagnostic[]; inputHash?: string}

const BOUNDS: MvuInitBounds = {
  inputBytes: 1048576, outputBytes: 1048576, depth: 32, descriptorDepth: 48,
  nodes: 32000, arrayLength: 4096, numberMagnitude: 9007199254740991,
}
const DIALECTS = {
  A: {sha256: '3759d0c8b9f82c67a606afae11de9a90e3ee4e63298ef622b89ac9127eb77047',
    commit: 'b13b43bac24d585f2b523c12e423bb803fa9dd7c'},
  B: {sha256: '6e4756ba99968f9eab2c20810d27ca035b28f36791f7fa7dd701a57af37241e1',
    commit: 'b42817925d0391c15fa242a8238d2bbe28eb6319'},
  D: {sha256: 'dcdbd5b0b837439d90fd0f783bedc1453fa6b8583d9d6a41f16f53a48e3b6dc3'},
} as const
const FORBIDDEN = new Set(['__proto__', 'prototype', 'constructor'])
const AUTHOR_SCHEMA = new Set(['$meta', '$schema', '$template', '$required', '$default'])
const sha = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)
const isObject = (value: unknown): value is MvuJsonObject => !!value && typeof value === 'object' && !Array.isArray(value)

class Refusal extends Error {
  constructor(readonly code: string, readonly pointer: string) { super(code) }
}
function reject(code: string, pointer: string): never { throw new Refusal(code, pointer) }

/** Local canonical encoding owns this plan's hash contract: sorted UTF-16 keys, original array order. */
function canonical(value: MvuJsonValue): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key]!)}`).join(',')}}`
  }
  return JSON.stringify(value)
}
function dataHash(value: MvuJsonValue): string { return sha(canonical(value)) }

/** Reject accessors/cycles before reading values; accounting includes ignored descriptor fields. */
function finiteJson(value: unknown, pointer: string, aggregate?: {nodes: number}, depthLimit: number = BOUNDS.depth): MvuJsonValue {
  let nodes = 0
  let stringBytes = 0
  const ancestors = new Set<object>()
  const visit = (item: unknown, path: string, depth: number): MvuJsonValue => {
    if (++nodes > BOUNDS.nodes || (aggregate && ++aggregate.nodes > BOUNDS.nodes)) reject('NODE_LIMIT', pointer)
    if (depth > depthLimit) reject('DEPTH_LIMIT', pointer)
    if (typeof item === 'string') {
      stringBytes += Buffer.byteLength(item, 'utf8')
      if (stringBytes > BOUNDS.inputBytes) reject('BYTE_LIMIT', pointer)
      return item
    }
    if (item === null || typeof item === 'boolean') return item
    if (typeof item === 'number') {
      if (!Number.isFinite(item) || Math.abs(item) > BOUNDS.numberMagnitude) reject('NUMBER_LIMIT', path)
      return Object.is(item, -0) ? 0 : item
    }
    if (typeof item !== 'object') reject('NON_JSON_VALUE', path)
    const object = item as object
    const prototype = Object.getPrototypeOf(object)
    if (prototype !== Object.prototype && prototype !== null && prototype !== Array.prototype) reject('OBJECT_PROTOTYPE', path)
    if (ancestors.has(object)) reject('CYCLIC_VALUE', path)
    if (Object.getOwnPropertySymbols(object).length) reject('NON_JSON_VALUE', path)
    ancestors.add(object)
    const descriptors = Object.getOwnPropertyDescriptors(object)
    let result: MvuJsonValue
    if (Array.isArray(object)) {
      if (object.length > BOUNDS.arrayLength) reject('ARRAY_LIMIT', path)
      result = []
      for (let index = 0; index < object.length; index++) {
        const descriptor = descriptors[String(index)]
        if (!descriptor || !own(descriptor, 'value')) reject('NON_JSON_VALUE', path)
        result.push(visit(descriptor.value, `${path}/${index}`, depth + 1))
      }
      if (Object.keys(descriptors).some(key => key !== 'length'
        && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= object.length))) reject('ARRAY_PROPERTY', path)
    } else {
      result = {}
      for (const key of Object.keys(descriptors)) {
        stringBytes += Buffer.byteLength(key, 'utf8')
        if (stringBytes > BOUNDS.inputBytes) reject('BYTE_LIMIT', pointer)
        if (FORBIDDEN.has(key)) reject('PROTOTYPE_KEY', path)
        const descriptor = descriptors[key]!
        if (!descriptor.enumerable || !own(descriptor, 'value')) reject('NON_JSON_VALUE', path)
        result[key] = visit(descriptor.value, `${path}/${key.replace(/~/g, '~0').replace(/\//g, '~1')}`, depth + 1)
      }
    }
    ancestors.delete(object)
    return result
  }
  const result = visit(value, pointer, 0)
  if (Buffer.byteLength(canonical(result), 'utf8') > BOUNDS.inputBytes) reject('BYTE_LIMIT', pointer)
  return result
}

function exact(value: unknown, required: string[], optional: string[], pointer: string): asserts value is MvuJsonObject {
  if (!isObject(value)) reject('DESCRIPTOR_SHAPE', pointer)
  if (required.some(key => !own(value, key)) || Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) {
    reject('DESCRIPTOR_SHAPE', pointer)
  }
}
function identifier(value: unknown, pointer: string): asserts value is string {
  if (typeof value !== 'string' || !value.length || value.length > 256 || /[\u0000-\u001f]/.test(value)) reject('IDENTITY', pointer)
  if (FORBIDDEN.has(value)) reject('PROTOTYPE_KEY', pointer)
}
function hash(value: unknown, pointer: string): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) reject('SOURCE_HASH', pointer)
}
function jsonObject(value: unknown, pointer: string, aggregate?: {nodes: number}): MvuJsonObject {
  const checked = finiteJson(value, pointer, aggregate)
  if (!isObject(checked)) reject('JSON_OBJECT_REQUIRED', pointer)
  const checkSchema = (item: MvuJsonValue): void => {
    if (!item || typeof item !== 'object') return
    for (const key of Object.keys(item)) {
      if (AUTHOR_SCHEMA.has(key) || key.startsWith('$')) reject('AUTHOR_SCHEMA_UNSUPPORTED', pointer)
      checkSchema((item as MvuJsonObject)[key]!)
    }
  }
  checkSchema(checked)
  return checked
}

function validate(input: MvuJsonObject): asserts input is MvuJsonObject & MvuInitSourceInput {
  exact(input, ['schemaVersion', 'source', 'books', 'bookStatData', 'bookStatDataSha256', 'initializedBooks', 'messageIndex',
    'swipes', 'selectedSwipeIdentity', 'capabilities'], [], '')
  if (input.schemaVersion !== 1) reject('INPUT_VERSION', '/schemaVersion')
  exact(input.source, ['verified', 'sourceId', 'sourceSha256', 'dialect', 'dialectSha256', 'loader',
    'originalLoaderSettlement'], ['commit'], '/source')
  const source = input.source
  if (source.verified !== true) reject('UNVERIFIED_SOURCE', '/source')
  identifier(source.sourceId, '/source/sourceId')
  hash(source.sourceSha256, '/source/sourceSha256')
  if (!['A', 'B', 'D'].includes(source.dialect as string)) reject('UNKNOWN_DIALECT', '/source/dialect')
  const dialect = DIALECTS[source.dialect as MvuInitDialect]
  if (source.dialectSha256 !== dialect.sha256) reject('UNKNOWN_DIALECT', '/source/dialectSha256')
  if ('commit' in dialect ? source.commit !== dialect.commit : own(source, 'commit')) reject('DIALECT_PROVENANCE', '/source/commit')
  exact(source.loader, ['selection', 'candidateCount', 'enabled', 'preferred'], [], '/source/loader')
  if (!['observed-exact', 'declared-single-exact'].includes(source.loader.selection as string)
    || typeof source.loader.candidateCount !== 'number' || !Number.isInteger(source.loader.candidateCount)
    || source.loader.candidateCount < 1 || source.loader.candidateCount > BOUNDS.arrayLength
    || (source.loader.selection === 'declared-single-exact' && source.loader.candidateCount !== 1)
    || typeof source.loader.enabled !== 'boolean'
    || typeof source.loader.preferred !== 'boolean') reject('UNVERIFIED_LOADER', '/source/loader')
  if (!['not-proven', 'proven'].includes(source.originalLoaderSettlement as string)) reject('LOADER_SETTLEMENT', '/source')
  validateCalculation(input)
}

function validateCalculation(input: MvuJsonObject): asserts input is MvuJsonObject & MvuCalculationInput {
  if (input.messageIndex !== 0) reject('MESSAGE_SCOPE', '/messageIndex')
  if (!Array.isArray(input.books) || !Array.isArray(input.swipes) || !Array.isArray(input.initializedBooks)) {
    reject('DESCRIPTOR_SHAPE', '')
  }
  let phase = 0
  let primaries = 0
  const bookSources = new Map<string, string>()
  for (const [index, book] of input.books.entries()) {
    const pointer = `/books/${index}`
    exact(book, ['identity', 'binding', 'sourceSha256', 'entries'], [], pointer)
    identifier(book.identity, pointer)
    hash(book.sourceSha256, pointer)
    const next = ['global', 'primary', 'additional'].indexOf(book.binding as string)
    if (next < phase || next < 0 || (next === 1 && ++primaries > 1)) reject('BOOK_ORDER', pointer)
    phase = next
    if (!Array.isArray(book.entries)) reject('DESCRIPTOR_SHAPE', pointer)
    const inventory = `${book.sourceSha256}:${canonical(book.entries)}`
    if (bookSources.has(book.identity) && bookSources.get(book.identity) !== inventory) reject('BOOK_IDENTITY_CONFLICT', pointer)
    bookSources.set(book.identity, inventory)
    const entries = new Set<string>()
    for (const [entryIndex, entry] of book.entries.entries()) {
      const entryPointer = `${pointer}/entries/${entryIndex}`
      exact(entry, ['identity', 'comment', 'enabled', 'content'], ['rendered'], entryPointer)
      identifier(entry.identity, entryPointer)
      if (entries.has(entry.identity)) reject('ENTRY_IDENTITY_CONFLICT', entryPointer)
      entries.add(entry.identity)
      if (typeof entry.comment !== 'string' || typeof entry.content !== 'string' || typeof entry.enabled !== 'boolean') {
        reject('DESCRIPTOR_SHAPE', entryPointer)
      }
    }
  }
  for (const identity of input.initializedBooks) identifier(identity, '/initializedBooks')
  if (new Set(input.initializedBooks).size !== input.initializedBooks.length) reject('BOOK_IDENTITY_CONFLICT', '/initializedBooks')
  const swipes = new Set<string>()
  for (const [index, swipe] of input.swipes.entries()) {
    const pointer = `/swipes/${index}`
    exact(swipe, ['identity', 'sourceSha256', 'rawOpening', 'statData', 'statDataSha256'], ['renderedBlocks','materialization'], pointer)
    identifier(swipe.identity, pointer)
    hash(swipe.sourceSha256, pointer)
    if (typeof swipe.rawOpening !== 'string' || sha(swipe.rawOpening) !== swipe.sourceSha256) reject('OPENING_HASH', pointer)
    if (swipes.has(swipe.identity)) reject('SWIPE_IDENTITY_CONFLICT', pointer)
    swipes.add(swipe.identity)
    if (own(swipe, 'renderedBlocks') && !Array.isArray(swipe.renderedBlocks)) reject('DESCRIPTOR_SHAPE', pointer)
  }
  identifier(input.selectedSwipeIdentity, '/selectedSwipeIdentity')
  if (!swipes.has(input.selectedSwipeIdentity)) reject('SELECTED_SWIPE', '/selectedSwipeIdentity')
  exact(input.capabilities, ['macros', 'schema', 'callbacks', 'openingUpdates'], [], '/capabilities')
}

function basis(input: MvuCalculationInput): MvuInitBasis {
  const bookStatData = jsonObject(input.bookStatData, '/bookStatData')
  if (dataHash(bookStatData) !== input.bookStatDataSha256) reject('BASIS_HASH', '/bookStatDataSha256')
  const swipes = input.swipes.map((swipe, index) => {
    const statData = jsonObject(swipe.statData, `/swipes/${index}/statData`)
    if (dataHash(statData) !== swipe.statDataSha256) reject('BASIS_HASH', `/swipes/${index}/statDataSha256`)
    return {identity: swipe.identity, sourceSha256: swipe.sourceSha256, statData, statDataSha256: swipe.statDataSha256}
  })
  return {bookStatData, bookStatDataSha256: input.bookStatDataSha256, initializedBooks: [...input.initializedBooks],
    selectedSwipeIdentity: input.selectedSwipeIdentity, swipes}
}

function sourceIdentity(value: unknown): MvuInitUnverifiedIdentity | null {
  if (!isObject(value)) return null
  const identity: MvuInitUnverifiedIdentity = {}
  const descriptors = Object.getOwnPropertyDescriptors(value)
  for (const key of ['sourceId', 'sourceSha256', 'dialect', 'dialectSha256', 'commit'] as const) {
    const descriptor = descriptors[key]
    const item: unknown = descriptor && own(descriptor, 'value') ? descriptor.value : undefined
    if (typeof item === 'string' && item.length <= 256 && !/[\u0000-\u001f]/.test(item)) identity[key] = item
  }
  return identity
}

/** Arrays replace; object RHS overwrites non-object LHS and recursively merges object children. */
function merge(left: MvuJsonObject, right: MvuJsonObject): MvuJsonObject {
  for (const key of Object.keys(right)) {
    const incoming = right[key]!
    // Lodash may retain array objects when merging an object RHS. That non-JSON shape is outside this subset.
    if (isObject(incoming) && Array.isArray(left[key])) reject('MERGE_SHAPE_UNSUPPORTED', '/merge')
    left[key] = isObject(incoming)
      ? merge(isObject(left[key]) ? left[key] as MvuJsonObject : {}, incoming)
      : structuredClone(incoming)
  }
  return left
}
/**
 * The pinned book regexp captures first eligible header LF through last eligible closing LF.
 * Scan LF segments once instead of retrying a leading .* at every character. Dot still excludes
 * CR/U+2028/U+2029; XML closing accepts a line prefix, while fence closing starts at column zero.
 * This is that capture contract, not a general XML/Markdown interpreter.
 */
function captureBookWrapper(text: string, fence: boolean,metadata?:{header?:string}): string | undefined {
  const header = fence ? '```' : '<initvar>'
  let firstHeaderLf = -1
  let lastClosingLf = -1
  let cursor = 0
  while (cursor <= text.length) {
    const lf = text.indexOf('\n', cursor)
    const end = lf < 0 ? text.length : lf
    const line = text.slice(cursor, end)
    const headerAt = line.lastIndexOf(header)
    const lastDotBreak = Math.max(line.lastIndexOf('\r'), line.lastIndexOf('\u2028'), line.lastIndexOf('\u2029'))
    if (firstHeaderLf < 0 && lf >= 0 && headerAt >= 0 && headerAt > lastDotBreak) {
      firstHeaderLf = lf
      if(metadata)metadata.header=line.slice(headerAt)
    }
    let closingAt = line.indexOf('</initvar>')
    if (fence) closingAt = line.startsWith('```') ? 0 : -1
    const firstDotBreak = line.search(/[\r\u2028\u2029]/)
    if (firstHeaderLf >= 0 && cursor - 1 > firstHeaderLf && closingAt >= 0
      && (fence || firstDotBreak < 0 || closingAt < firstDotBreak)) lastClosingLf = cursor - 1
    if (lf < 0) break
    cursor = lf + 1
  }
  return lastClosingLf > firstHeaderLf && firstHeaderLf >= 0
    ? text.slice(firstHeaderLf + 1, lastClosingLf) : undefined
}
function extractEntry(content: string,metadata?:{header?:string}): string {
  const xml = captureBookWrapper(content.trim(), false)
  const candidate = xml ?? content
  const fence = captureBookWrapper(candidate.trim(), true,metadata)
  if(fence===undefined&&metadata)delete metadata.header
  return fence ?? candidate
}

/** Preserve greeting capture whitespace; native subset accepts balanced non-nested tags and paired simple fences. */
function greetingPayload(body: string, pointer: string,metadata?:{header?:string}): string {
  const first = body.search(/\S/)
  const openingFence = first >= 0 && body.startsWith('```', first)
  let end = body.length
  while (end > 0 && /\s/.test(body[end - 1]!)) end--
  const closingFence = end >= 3 && body.slice(end - 3, end) === '```'
  if (!openingFence && !closingFence) return body
  if (!openingFence || !closingFence) reject('INITVAR_FENCE_UNSUPPORTED', pointer)
  let headerEnd = first + 3
  while (headerEnd < body.length && !/[\r\n\u2028\u2029]/.test(body[headerEnd]!)) headerEnd++
  if (headerEnd >= end - 3) reject('INITVAR_FENCE_UNSUPPORTED', pointer)
  if(metadata)metadata.header=body.slice(first,headerEnd)
  const captured = body.slice(headerEnd, end - 3)
  // Another fence is ambiguous here; keep its source unsupported rather than infer Markdown nesting.
  if (captured.includes('```')) reject('INITVAR_FENCE_UNSUPPORTED', pointer)
  return captured
}

function extractGreetingPayloads(text: string, pointer: string,headers?:string[]): string[] {
  const result: string[] = []
  let openEnd = -1
  // ASCII tag regexp has no variable repetition and keeps offsets in the ORIGINAL UTF-16 source.
  // Lowercasing the whole source would move indices for characters such as U+0130.
  for (const tag of text.matchAll(/<\/?initvar>/gi)) {
    const closing = tag[0][1] === '/'
    if (!closing) {
      if (openEnd >= 0) reject('INITVAR_WRAPPER_UNSUPPORTED', pointer)
      openEnd = tag.index! + tag[0].length
    } else {
      if (openEnd < 0) reject('INITVAR_WRAPPER_UNSUPPORTED', pointer)
      if (result.length >= BOUNDS.arrayLength) reject('ARRAY_LIMIT', pointer)
      const metadata:{header?:string}={}
      result.push(greetingPayload(text.slice(openEnd, tag.index), pointer,headers?metadata:undefined))
      headers?.push(metadata.header??'')
      openEnd = -1
    }
  }
  if (openEnd >= 0) reject('INITVAR_WRAPPER_UNSUPPORTED', pointer)
  return result
}
/** The actual source owner and compiler share this selector and the same pinned
 * wrappers. Only entries used by InitVar and extracted greeting blocks count;
 * ordinary prose and unrelated YAML-looking colons cannot choose a policy. */
export function selectNativeMvuInitializationPolicy(input:{
  books:readonly {entries:readonly {comment:string;content:string;renderedContent:string}[]}[]
  swipes:readonly {rawOpening:string;renderedOpening:string;materialization?:'template'|'materialized'}[]
}):{kind:'selected';policy:NativeMvuSourcePolicy}|{kind:'unsupported';diagnostics:MvuInitDiagnostic[]} {
  try {
    let yaml=false
    for(const book of input.books)for(const entry of book.entries) {
      if(!entry.comment.toLowerCase().includes('[initvar]'))continue
      const rawHeader:{header?:string}={},expandedHeader:{header?:string}={}
      const raw=extractEntry(entry.content,rawHeader)
      const expanded=extractEntry(entry.renderedContent,expandedHeader)
      yaml||=nativeMvuPayloadGrammar(expanded,expandedHeader.header,rawHeader.header,raw)==='yaml'
    }
    for(const [index,swipe] of input.swipes.entries()) {
      if(swipe.materialization==='materialized')continue
      const rawHeaders:string[]=[],expandedHeaders:string[]=[]
      const raw=extractGreetingPayloads(swipe.rawOpening,`/swipes/${index}`,rawHeaders)
      const expanded=extractGreetingPayloads(swipe.renderedOpening,`/swipes/${index}`,expandedHeaders)
      if(raw.length!==expanded.length)reject('MACRO_BINDING',`/swipes/${index}`)
      for(const [block,text] of expanded.entries()) {
        yaml||=nativeMvuPayloadGrammar(text,expandedHeaders[block],rawHeaders[block],raw[block])==='yaml'
      }
    }
    return {kind:'selected',policy:yaml?NATIVE_MVU_YAML_SOURCE_POLICY:NATIVE_MVU_SOURCE_POLICY}
  } catch(error) {
    return {kind:'unsupported',diagnostics:[error instanceof Refusal?{code:error.code,pointer:error.pointer}
      :{code:'INVALID_INPUT',pointer:''}]}
  }
}
interface ParsedPayload {
  data: MvuJsonObject
  payloadSha256: string
  renderedSha256: string
  dataSha256: string
  contentSha256?: string
}
interface PayloadContext {
  macros: MvuInitSourceInput['capabilities']['macros']
  nodes: number
  cache: Map<string, ParsedPayload>
  yaml?:boolean
}
function hasClosedMacro(text: string): boolean {
  const start = text.indexOf('{{')
  return start >= 0 && text.indexOf('}}', start + 2) >= 0
}
function payload(text: string, rendered: MvuInitRenderedPayload | undefined,
  context: PayloadContext, pointer: string,grammar:'json'|'yaml'='json'): ParsedPayload {
  const cached = context.cache.get(pointer)
  if (cached) return cached
  const macros = context.macros
  let parseText = text
  if (rendered) {
    exact(rendered, ['capability', 'sourceSha256', 'text'], [], pointer)
    if (macros !== 'verified-rendered' || rendered.capability !== 'server-verified'
      || rendered.sourceSha256 !== sha(text) || typeof rendered.text !== 'string') reject('MACRO_BINDING', pointer)
    parseText = rendered.text
  } else if (hasClosedMacro(text)) reject('MACRO_UNSUPPORTED', pointer)
  if (hasClosedMacro(parseText)) reject('MACRO_UNSUPPORTED', pointer)
  let parsed: unknown
  if(context.yaml&&grammar==='yaml') {
    const result=parseMvuYamlData(parseText)
    if(result.kind==='rejected')reject(result.code,pointer+(result.pointer??''))
    parsed=result.data
  } else try { parsed = JSON.parse(parseText) } catch { reject('NON_STRICT_JSON', pointer) }
  const data = jsonObject(parsed, pointer, context)
  const result = {data, payloadSha256: sha(text), renderedSha256: sha(parseText), dataSha256: dataHash(data)}
  context.cache.set(pointer, result)
  return result
}

function loadBooks(input: MvuCalculationInput, starting: MvuJsonObject, seen: string[], context: PayloadContext): MvuInitStateResult {
  let statData = structuredClone(starting)
  const initialized = new Set(seen)
  const books: MvuInitBookStep[] = []
  for (const [index, book] of input.books.entries()) {
    const step: MvuInitBookStep = {identity: book.identity, binding: book.binding, sourceSha256: book.sourceSha256,
      status: 'already-initialized', entries: [], resultSha256: dataHash(statData)}
    books.push(step)
    if (initialized.has(book.identity)) continue
    initialized.add(book.identity)
    let merged: MvuJsonObject = {}
    for (const [entryIndex, entry] of book.entries.entries()) {
      // Pinned API uses filter:none. An entry's disabled flag does not disable initialization.
      if (!entry.comment.toLowerCase().includes('[initvar]')) continue
      const pointer = `/books/${index}/entries/${entryIndex}`
      // Reloading a book must not rescan/hash a potentially large immutable payload once per swipe.
      let parsed=context.cache.get(pointer)
      if(!parsed) {
        const metadata:{header?:string}={}
        const text=extractEntry(entry.content,metadata)
        parsed=payload(text,entry.rendered,context,pointer,
          context.yaml?nativeMvuPayloadGrammar(entry.rendered?.text??text,metadata.header,metadata.header,text):'json')
      }
      parsed.contentSha256 ??= sha(entry.content)
      merged = merge(merged, parsed.data)
      step.entries.push({identity: entry.identity, contentSha256: parsed.contentSha256,
        payloadSha256: parsed.payloadSha256, renderedSha256: parsed.renderedSha256, dataSha256: parsed.dataSha256})
    }
    // This spread is deliberately shallow: earlier/existing entire top-level values win.
    statData = jsonObject({...merged, ...statData}, `/books/${index}/result`)
    step.status = 'loaded'
    step.resultSha256 = dataHash(statData)
  }
  return {statData, dataSha256: dataHash(statData), initializedBooks: [...initialized], books}
}

function calculate(safe: MvuCalculationInput, existing: MvuInitBasis,nativePolicy?:NativeMvuSourcePolicy,
  openingUpdateDeferred=false) {
  const base = existing.bookStatData
  const context: PayloadContext = {macros: safe.capabilities.macros, nodes: 0, cache: new Map(),
    ...(nativePolicy&&isNativeMvuYamlSourcePolicy(nativePolicy)?{yaml:true}:{})}
  const baseline = loadBooks(safe, base, [...safe.initializedBooks], context)
  const swipes: MvuInitSwipePlan[] = []
  let resultBytes = Buffer.byteLength(canonical(baseline as unknown as MvuJsonObject), 'utf8')
    + Buffer.byteLength(canonical(existing as unknown as MvuJsonObject), 'utf8')
  for (const [index, swipe] of safe.swipes.entries()) {
    if (!openingUpdateDeferred&&swipe.materialization!=='materialized'&&/<(?:updatevariable|updatevar|jsonpatch)\b|_\.(?:set|add|assign|delete|remove)\s*\(/i.test(swipe.rawOpening)) {
      reject('OPENING_UPDATE_UNSUPPORTED', `/swipes/${index}`)
    }
    let statData = merge(jsonObject(swipe.statData, `/swipes/${index}/statData`), structuredClone(baseline.statData))
    const blocks: MvuInitSwipePlan['blocks'] = []
    let replacement: MvuJsonObject = {}
    const headers:string[]=[]
    const matches = swipe.materialization==='materialized'?[]:extractGreetingPayloads(swipe.rawOpening, `/swipes/${index}`,headers)
    if (swipe.renderedBlocks && swipe.renderedBlocks.length !== matches.length) reject('MACRO_BINDING', `/swipes/${index}`)
    for (const [blockIndex, match] of matches.entries()) {
      const parsed = payload(match, swipe.renderedBlocks?.[blockIndex], context,
        `/swipes/${index}/blocks/${blockIndex}`,context.yaml?nativeMvuPayloadGrammar(swipe.renderedBlocks?.[blockIndex]?.text??match,
          headers[blockIndex],headers[blockIndex],match):'json')
      replacement = merge(replacement, parsed.data)
      blocks.push({payloadSha256: parsed.payloadSha256, renderedSha256: parsed.renderedSha256, dataSha256: parsed.dataSha256})
    }
    let initializedBooks = [...baseline.initializedBooks]
    let books: MvuInitBookStep[] = []
    if (blocks.length) {
      const primary = safe.books.find(book => book.binding === 'primary')?.identity
      if (!primary) reject('PRIMARY_BINDING_UNKNOWN', `/swipes/${index}`)
      const reloaded = loadBooks(safe, replacement, [primary], context)
      statData = reloaded.statData
      initializedBooks = reloaded.initializedBooks
      books = reloaded.books
    }
    statData = jsonObject(statData, `/swipes/${index}/result`)
    const step = {identity: swipe.identity, sourceSha256: swipe.sourceSha256, replaced: blocks.length > 0,
      blocks, books, statData, initializedBooks, dataSha256: dataHash(statData)}
    resultBytes += Buffer.byteLength(canonical(step as unknown as MvuJsonObject), 'utf8')
    if (resultBytes > BOUNDS.outputBytes) reject('OUTPUT_BYTE_LIMIT', '/plan')
    swipes.push(step)
  }
  return {baseline, swipes}
}

/**
 * Deterministic data subset only: no persistence, callbacks, schema execution, host access or model fallback.
 * Book wrappers retain pinned first-header/last-close captures through bounded LF scans. Greetings accept
 * balanced non-nested tags and paired simple fences; ambiguous/unterminated forms are explicitly unsupported.
 * Capture whitespace is source identity, even when JSON.parse would produce equivalent values after trimming.
 */
export function compileMvuInitSources(input: MvuInitSourceInput): MvuInitCompileResult {
  let source: MvuInitUnverifiedIdentity | null = null
  let inputHash: string | undefined
  try {
    // Even a budget refusal preserves bounded identity without invoking input accessors or returning payload fields.
    const descriptor = input && typeof input === 'object' ? Object.getOwnPropertyDescriptor(input, 'source') : undefined
    source = sourceIdentity(descriptor && own(descriptor, 'value') ? descriptor.value : undefined)
    const checked = finiteJson(input, '', undefined, BOUNDS.descriptorDepth)
    if (!isObject(checked)) reject('DESCRIPTOR_SHAPE', '')
    // Preserve only JSON-safe source identity; diagnostics never expose payload/parser error text.
    source = sourceIdentity(checked.source)
    inputHash = dataHash(checked)
    validate(checked)
    const safe = checked as unknown as MvuInitSourceInput
    const existing = basis(safe)
    const none = (reason: 'loader-disabled' | 'loader-not-preferred' | 'no-new-book'): MvuInitCompileResult =>
      ({schemaVersion: 1, kind: 'none', source: safe.source, inputHash: inputHash!, reason,
        basis: existing, basisHash: dataHash(existing as unknown as MvuJsonObject)})
    if (!safe.source.loader.enabled) return none('loader-disabled')
    if (!safe.source.loader.preferred) return none('loader-not-preferred')
    // No newly read book means the actual initCheck returns before opening parsing and capability use.
    if (safe.books.every(book => safe.initializedBooks.includes(book.identity))) return none('no-new-book')
    if (!['none', 'verified-rendered'].includes(safe.capabilities.macros)) reject('MACRO_CAPABILITY', '/capabilities/macros')
    if (safe.capabilities.schema !== 'json-object-subset-v1') reject('SCHEMA_CAPABILITY', '/capabilities/schema')
    if (safe.capabilities.callbacks !== 'none') reject('CALLBACK_CAPABILITY', '/capabilities/callbacks')
    if (safe.capabilities.openingUpdates !== 'none') reject('OPENING_UPDATE_CAPABILITY', '/capabilities/openingUpdates')
    // Unique parsed payload nodes are bounded in aggregate; reloading the same book reuses verified data.
    const {baseline, swipes} = calculate(safe, existing)
    const dialect = DIALECTS[safe.source.dialect]
    const staticSourceVersion = 'commit' in dialect
      ? {dialect: safe.source.dialect, sha256: dialect.sha256, commit: dialect.commit}
      : {dialect: safe.source.dialect, sha256: dialect.sha256}
    const content = {schemaVersion: 1 as const, policy: 'strict-json-object-v1' as const, source: safe.source,
      staticSourceVersion, capability: 'native-json-data-only' as const, bounds: {...BOUNDS}, inputHash: inputHash!,
      assurance: 'supported-static' as const,
      basis: existing, basisHash: dataHash(existing as unknown as MvuJsonObject),
      selectedSwipeIdentity: safe.selectedSwipeIdentity, baseline, swipes}
    let bounded: MvuJsonValue
    try { bounded = finiteJson(content, '/plan', undefined, BOUNDS.descriptorDepth) } catch (error) {
      if (error instanceof Refusal && error.code === 'BYTE_LIMIT') reject('OUTPUT_BYTE_LIMIT', '/plan')
      throw error
    }
    const plan = {...content, planHash: dataHash(bounded)}
    return {schemaVersion: 1, kind: 'supported', plan}
  } catch (error) {
    const diagnostic = error instanceof Refusal ? {code: error.code, pointer: error.pointer} : {code: 'INVALID_INPUT', pointer: ''}
    return {schemaVersion: 1, kind: 'unsupported', source, diagnostics: [diagnostic], ...(inputHash ? {inputHash} : {})}
  }
}

function requireContentHash(value: unknown, field: string, code: string, pointer: string): MvuJsonObject {
  if (!isObject(value)) reject(code, pointer)
  const digest = value[field]
  hash(digest, pointer)
  const content = {...value}
  delete content[field]
  if (dataHash(content) !== digest) reject(code, pointer)
  return value
}

type RawCalculationData = Pick<NativeMvuJsonCandidate,
  'books' | 'bookStatData' | 'initializedBooks' | 'messageIndex' | 'selectedSwipeIdentity' | 'swipes'>
  & {macros: SchemaMvuInitDataSource['macros']}

function prepareCalculationBooks(input: RawCalculationData): MvuInitBook[] {
  const rendered = input.macros === 'verified-identity-rendering'
  return input.books.map((book, bookIndex) => ({
    identity: book.identity, binding: book.binding, sourceSha256: book.sourceSha256,
    entries: book.entries.map((entry, entryIndex) => {
      const pointer = `/books/${bookIndex}/entries/${entryIndex}`
      if (sha(entry.content) !== entry.contentSha256 || sha(entry.renderedContent) !== entry.renderedContentSha256
        || !rendered && entry.content !== entry.renderedContent) reject('MACRO_BINDING', pointer)
      const raw = extractEntry(entry.content)
      const expanded = extractEntry(entry.renderedContent)
      return {identity: entry.identity, comment: entry.comment, enabled: entry.enabled, content: entry.content,
        ...(rendered && raw !== expanded ? {rendered: {
          capability: 'server-verified' as const, sourceSha256: sha(raw), text: expanded,
        }} : {})}
    }),
  }))
}

function prepareCalculationSwipe(swipe: RawCalculationData['swipes'][number], index: number,
  rendered: boolean): MvuInitSwipe {
  const pointer = `/swipes/${index}`
  if (sha(swipe.rawOpening) !== swipe.sourceSha256 || sha(swipe.renderedOpening) !== swipe.renderedSha256
    || dataHash(swipe.statData as MvuJsonObject) !== dataHash({})
    || (!rendered||swipe.materialization==='materialized') && swipe.rawOpening !== swipe.renderedOpening) reject('FRESH_BASIS', pointer)
  const raw = swipe.materialization==='materialized'?[]:extractGreetingPayloads(swipe.rawOpening, pointer)
  const expanded = swipe.materialization==='materialized'?[]:extractGreetingPayloads(swipe.renderedOpening, pointer)
  if (raw.length !== expanded.length) reject('MACRO_BINDING', pointer)
  return {identity: swipe.identity, sourceSha256: swipe.sourceSha256, rawOpening: swipe.rawOpening,
    statData: {}, statDataSha256: dataHash({}),
    ...(swipe.materialization?{materialization:swipe.materialization}:{}),
    ...(rendered ? {renderedBlocks: raw.map((text, block) => ({
      capability: 'server-verified' as const, sourceSha256: sha(text), text: expanded[block]!,
    }))} : {})}
}

/** Both entry points use this preparation and the same bounded calculation.
 * Native's already observed Source/fresh references remain checked by its caller. */
function prepareCalculationData(input: RawCalculationData,
  books = prepareCalculationBooks(input),
  swipes = input.swipes.map((swipe, index) => prepareCalculationSwipe(swipe, index,
    input.macros === 'verified-identity-rendering'))) {
  const calculation = {books, bookStatData: {}, bookStatDataSha256: dataHash({}), initializedBooks: [], messageIndex: 0,
    swipes, selectedSwipeIdentity: input.selectedSwipeIdentity,
    capabilities: {macros: input.macros === 'verified-identity-rendering' ? 'verified-rendered' : 'none',
      schema: 'json-object-subset-v1', callbacks: 'none', openingUpdates: 'none'}}
  const calculationJson = finiteJson(calculation, '', undefined, BOUNDS.descriptorDepth)
  if (!isObject(calculationJson)) reject('DESCRIPTOR_SHAPE', '')
  validateCalculation(calculationJson)
  const safe = calculationJson as unknown as MvuCalculationInput
  return {safe, existing: basis(safe)}
}

/** Compile only raw pre-transform initialization data. Source ownership,
 * schema execution and a fresh Native publication lease are separate proofs. */
export function compileSchemaMvuInitData(input: SchemaMvuInitDataSource|SchemaMvuInitDataSourceV2): SchemaMvuInitDataResult {
  let inputHash: string | undefined
  try {
    const checked = finiteJson(input, '', undefined, BOUNDS.descriptorDepth)
    if (!isObject(checked)) reject('DESCRIPTOR_SHAPE', '')
    inputHash = dataHash(checked)
    exact(checked, ['schemaVersion', 'encoding', 'grammar', 'books', 'bookStatData', 'initializedBooks',
      'messageIndex', 'selectedSwipeIdentity', 'swipes', 'macros', 'initSourceSha256'], [], '')
    if (!(checked.schemaVersion === 1 && checked.encoding === 'native-mvu-schema-opening-init-source-v1')
      && !(checked.schemaVersion === 2 && checked.encoding === 'native-mvu-schema-opening-init-source-v2')) {
      reject('INPUT_VERSION', '/schemaVersion')
    }
    requireContentHash(checked, 'initSourceSha256', 'INIT_SOURCE_HASH', '/initSourceSha256')
    if (!['strict-json-object-v1', 'yaml-1.2-json-data-v1'].includes(checked.grammar as string)) {
      reject('INIT_GRAMMAR', '/grammar')
    }
    if (!['none', 'verified-identity-rendering'].includes(checked.macros as string)) reject('MACRO_CAPABILITY', '/macros')
    if (!Array.isArray(checked.books) || !Array.isArray(checked.swipes)) reject('DESCRIPTOR_SHAPE', '')
    if (checked.books.length > 1) reject('PRIMARY_BINDING_UNKNOWN', '/books')
    if (!Array.isArray(checked.initializedBooks) || checked.initializedBooks.length || checked.messageIndex !== 0
      || dataHash(jsonObject(checked.bookStatData, '/bookStatData')) !== dataHash({})) reject('FRESH_BASIS', '/bookStatData')
    for (const [index, book] of checked.books.entries()) {
      const pointer = `/books/${index}`
      exact(book, ['identity', 'binding', 'sourcePointer', 'sourceSha256', 'entries'], [], pointer)
      if (book.binding !== 'primary') reject('PRIMARY_BINDING_UNKNOWN', pointer)
      identifier(book.sourcePointer, `${pointer}/sourcePointer`)
      if (!Array.isArray(book.entries)) reject('DESCRIPTOR_SHAPE', pointer)
      for (const [entryIndex, entry] of book.entries.entries()) {
        const entryPointer = `${pointer}/entries/${entryIndex}`
        exact(entry, ['identity', 'sourcePointer', 'comment', 'enabled', 'content', 'contentSha256',
          'renderedContent', 'renderedContentSha256'], [], entryPointer)
        identifier(entry.sourcePointer, `${entryPointer}/sourcePointer`)
        if (typeof entry.content !== 'string' || typeof entry.renderedContent !== 'string'
          || typeof entry.comment !== 'string' || typeof entry.enabled !== 'boolean') reject('DESCRIPTOR_SHAPE', entryPointer)
        hash(entry.contentSha256, `${entryPointer}/contentSha256`)
        hash(entry.renderedContentSha256, `${entryPointer}/renderedContentSha256`)
      }
    }
    for (const [index, swipe] of checked.swipes.entries()) {
      exact(swipe, ['identity', 'sourcePointer', 'sourceSha256', 'rawOpening', 'renderedOpening',
        'renderedSha256', 'statData'], ['materialization'], `/swipes/${index}`)
      identifier(swipe.sourcePointer, `/swipes/${index}/sourcePointer`)
      if (typeof swipe.rawOpening !== 'string' || typeof swipe.renderedOpening !== 'string') {
        reject('DESCRIPTOR_SHAPE', `/swipes/${index}`)
      }
      hash(swipe.sourceSha256, `/swipes/${index}/sourceSha256`)
      hash(swipe.renderedSha256, `/swipes/${index}/renderedSha256`)
    }
    const source = checked as unknown as SchemaMvuInitDataSource|SchemaMvuInitDataSourceV2
    let openingUpdate:ParsedMvuUpdateV2|undefined
    if(source.schemaVersion===2) {
      if(source.swipes.length!==1||source.swipes[0]!.identity!==source.selectedSwipeIdentity)reject('FRESH_BASIS','/swipes')
      const candidate=parseMvuUpdateV2(source.swipes[0]!.renderedOpening)
      if(candidate.kind!=='parsed')reject(candidate.kind==='rejected'?candidate.code:'OPENING_UPDATE_REQUIRED','/swipes/0')
      openingUpdate=candidate
    }
    const {safe, existing} = prepareCalculationData(source)
    const selectedPolicy = selectNativeMvuInitializationPolicy(source)
    if (selectedPolicy.kind === 'unsupported') reject(selectedPolicy.diagnostics[0]!.code, selectedPolicy.diagnostics[0]!.pointer)
    const grammar = isNativeMvuYamlSourcePolicy(selectedPolicy.policy) ? 'yaml-1.2-json-data-v1' : 'strict-json-object-v1'
    if (grammar !== source.grammar) reject('INIT_GRAMMAR', '/grammar')
    const {baseline, swipes} = calculate(safe, existing, selectedPolicy.policy,source.schemaVersion===2)
    const selected = swipes.find(swipe => swipe.identity === source.selectedSwipeIdentity)!
    const initialized: MvuJsonObject = {}
    for (const identity of selected.initializedBooks) initialized[identity] = true
    // Owned context metadata; this is not an author schema or a grant. The
    // schema runner supplies its own placeholder only at update-ended.
    const context: MvuJsonObject = {initialized_lorebooks: initialized}
    const content = {kind: 'parsed' as const, values: structuredClone(selected.statData), valuesSha256: selected.dataSha256,
      context, baseline, swipes, initSourceSha256: source.initSourceSha256,...(openingUpdate?{openingUpdate}:{})}
    try { finiteJson(content, '/result', undefined, BOUNDS.descriptorDepth) } catch (error) {
      if (error instanceof Refusal && error.code === 'BYTE_LIMIT') reject('OUTPUT_BYTE_LIMIT', '/result')
      throw error
    }
    return content
  } catch (error) {
    const diagnostic = error instanceof Refusal ? {code: error.code, pointer: error.pointer} : {code: 'INVALID_INPUT', pointer: ''}
    return {kind: 'unsupported', diagnostics: [diagnostic], ...(inputHash ? {inputHash} : {})}
  }
}

/** Compile a descriptor produced by the actual Core source owner. Hashes validate its encoding,
 * not its authority: the caller must still verify the durable source and fresh-basis facts.
 * This path never fabricates an observed/declared original loader for the shared calculation. */
export function compileNativeMvuInitSources(input: NativeMvuJsonCandidate): NativeMvuInitCompileResult {
  let inputHash: string | undefined
  try {
    const checked = finiteJson(input, '', undefined, BOUNDS.descriptorDepth)
    if (!isObject(checked)) reject('DESCRIPTOR_SHAPE', '')
    inputHash = dataHash(checked)
    exact(checked, ['schemaVersion', 'encoding', 'policy', 'sourceSnapshot', 'freshNativeBasisProof',
      'books', 'bookStatData', 'initializedBooks', 'messageIndex', 'selectedSwipeIdentity', 'swipes', 'capabilities'], [], '')
    if (checked.schemaVersion !== 1 || checked.encoding !== 'native-mvu-json-source-candidate-v1') {
      reject('INPUT_VERSION', '/schemaVersion')
    }
    if (!isNativeMvuSourcePolicy(checked.policy)) {
      reject('NATIVE_POLICY', '/policy')
    }
    const snapshot = requireContentHash(checked.sourceSnapshot, 'snapshotSha256', 'SOURCE_SNAPSHOT_HASH', '/sourceSnapshot')
    const fresh = requireContentHash(checked.freshNativeBasisProof, 'proofSha256', 'FRESH_BASIS', '/freshNativeBasisProof')
    if (snapshot.schemaVersion !== 1 || snapshot.encoding !== 'native-mvu-source-snapshot-v1'
      || fresh.schemaVersion !== 1 || fresh.encoding !== 'native-mvu-fresh-basis-proof-v1'
      || dataHash(snapshot.policy!) !== dataHash(checked.policy!)) reject('NATIVE_POLICY', '/sourceSnapshot')
    const candidate = checked as unknown as NativeMvuJsonCandidate
    const {sourceSnapshot, freshNativeBasisProof} = candidate
    const sourceSession = sourceSnapshot.source.sessionId
    if (freshNativeBasisProof.sessionId !== sourceSession || freshNativeBasisProof.ownerSessionId !== sourceSession
      || freshNativeBasisProof.branch.inheritance !== 'root' || freshNativeBasisProof.branch.parentSessionId !== null
      || freshNativeBasisProof.branch.inheritedPrefixLength !== 0 || freshNativeBasisProof.branch.ready !== true
      || freshNativeBasisProof.numerical.headExists !== false || freshNativeBasisProof.numerical.eventCount !== 0
      || freshNativeBasisProof.numerical.opaqueStateExists !== false
      || freshNativeBasisProof.native.committedOpeningCount !== 0 || freshNativeBasisProof.native.inheritedMessageCount !== 0
      || !Number.isSafeInteger(freshNativeBasisProof.native.observedThroughSeq)
      || freshNativeBasisProof.native.observedThroughSeq < -1) reject('FRESH_BASIS', '/freshNativeBasisProof')
    for (const value of [freshNativeBasisProof.branch.metaSha256, freshNativeBasisProof.numerical.eventMembershipSha256,
      freshNativeBasisProof.native.historyVersionSha256, freshNativeBasisProof.factsSha256]) hash(value, '/freshNativeBasisProof')
    if (candidate.books.length !== 1 || candidate.books[0]!.binding !== 'primary'
      || sourceSnapshot.bindings.global.length || sourceSnapshot.bindings.additional.length
      || !sourceSnapshot.bindings.primary
      || candidate.books[0]!.sourcePointer !== sourceSnapshot.bindings.primary.pointer
      || candidate.books[0]!.sourceSha256 !== sourceSnapshot.bindings.primary.sha256) {
      reject('PRIMARY_BINDING_UNKNOWN', '/books')
    }
    if (dataHash(candidate.bookStatData as MvuJsonObject) !== dataHash({})
      || freshNativeBasisProof.bookStatDataSha256 !== dataHash({})
      || candidate.initializedBooks.length || candidate.messageIndex !== 0) reject('FRESH_BASIS', '/bookStatData')
    if (candidate.capabilities.callbacks !== 'none' || candidate.capabilities.schema !== 'json-object-subset-v1'
      || !['none', 'verified-identity-rendering'].includes(candidate.capabilities.macros)) {
      reject('NATIVE_POLICY', '/capabilities')
    }
    const rendered = candidate.capabilities.macros === 'verified-identity-rendering'
    const calculationInput = {...candidate, macros: candidate.capabilities.macros}
    const books = prepareCalculationBooks(calculationInput)
    if (candidate.swipes.length !== sourceSnapshot.swipes.length
      || candidate.swipes.length !== freshNativeBasisProof.swipes.length) reject('SELECTED_SWIPE', '/swipes')
    const swipes: MvuInitSwipe[] = candidate.swipes.map((swipe, index) => {
      const pointer = `/swipes/${index}`
      const observed = sourceSnapshot.swipes[index]!
      const basisRef = freshNativeBasisProof.swipes[index]!
      if (swipe.identity !== observed.identity || swipe.sourcePointer !== observed.pointer
        || swipe.sourceSha256 !== observed.sourceSha256 || sha(swipe.rawOpening) !== swipe.sourceSha256
        || swipe.renderedSha256 !== observed.renderedSha256 || sha(swipe.renderedOpening) !== swipe.renderedSha256
        || basisRef.identity !== swipe.identity || basisRef.sourceSha256 !== swipe.sourceSha256
        || basisRef.statDataSha256 !== dataHash({}) || dataHash(swipe.statData as MvuJsonObject) !== dataHash({})
        || !rendered && swipe.rawOpening !== swipe.renderedOpening) reject('FRESH_BASIS', pointer)
      return prepareCalculationSwipe(swipe, index, rendered)
    })
    const selected = candidate.swipes.find(swipe => swipe.identity === candidate.selectedSwipeIdentity)
    if (!selected || selected.sourcePointer !== sourceSnapshot.selected.pointer
      || selected.sourceSha256 !== sourceSnapshot.selected.sourceSha256
      || selected.renderedSha256 !== sourceSnapshot.selected.renderedSha256) reject('SELECTED_SWIPE', '/selectedSwipeIdentity')
    const facts = {schemaVersion: 1, encoding: 'native-mvu-fresh-basis-facts-v1', sessionId: sourceSession,
      ownerSessionId: sourceSession, branch: freshNativeBasisProof.branch, numerical: freshNativeBasisProof.numerical,
      native: freshNativeBasisProof.native, basis: {bookStatData: {},
        swipes: swipes.map(swipe => ({identity: swipe.identity, sourceSha256: swipe.sourceSha256, statData: {}}))}}
    if (dataHash(facts as unknown as MvuJsonObject) !== freshNativeBasisProof.factsSha256) reject('FRESH_BASIS', '/freshNativeBasisProof')
    const {safe, existing} = prepareCalculationData(calculationInput, books, swipes)
    const selectedPolicy=selectNativeMvuInitializationPolicy(candidate)
    if(selectedPolicy.kind==='unsupported')reject(selectedPolicy.diagnostics[0]!.code,selectedPolicy.diagnostics[0]!.pointer)
    if(dataHash(selectedPolicy.policy as unknown as MvuJsonObject)!==dataHash(candidate.policy as unknown as MvuJsonObject)) {
      reject('NATIVE_POLICY','/policy')
    }
    const yaml=isNativeMvuYamlSourcePolicy(candidate.policy)
    const {baseline, swipes: compiledSwipes} = calculate(safe, existing,candidate.policy)
    const source: NativeMvuInitSourceIdentity = {authority: 'core-native-policy',
      sourceId: `import-${sourceSnapshot.source.sourceRecordSessionId}-${sourceSnapshot.source.importId}`,
      sourceSha256: sourceSnapshot.source.rawSha256, policy: candidate.policy, originalLoaderSettlement: 'not-proven'}
    identifier(source.sourceId, '/source/sourceId')
    hash(source.sourceSha256, '/source/sourceSha256')
    const content = {schemaVersion: 2 as const, policy: yaml?'yaml-1.2-json-data-v1' as const:'strict-json-object-v1' as const, source,
      staticSourceVersion: {dialect: 'A' as const, sha256: DIALECTS.A.sha256, commit: DIALECTS.A.commit},
      capability: yaml?'native-json-yaml-data-only' as const:'native-json-data-only' as const,
      bounds: {...BOUNDS}, inputHash: inputHash!, assurance: 'supported-static' as const,
      basis: existing, basisHash: dataHash(existing as unknown as MvuJsonObject),
      selectedSwipeIdentity: safe.selectedSwipeIdentity, baseline, swipes: compiledSwipes}
    let bounded: MvuJsonValue
    try { bounded = finiteJson(content, '/plan', undefined, BOUNDS.descriptorDepth) } catch (error) {
      if (error instanceof Refusal && error.code === 'BYTE_LIMIT') reject('OUTPUT_BYTE_LIMIT', '/plan')
      throw error
    }
    return {schemaVersion: 2, kind: 'supported', plan: {...content, planHash: dataHash(bounded)}}
  } catch (error) {
    const diagnostic = error instanceof Refusal ? {code: error.code, pointer: error.pointer} : {code: 'INVALID_INPUT', pointer: ''}
    return {schemaVersion: 2, kind: 'unsupported', diagnostics: [diagnostic], ...(inputHash ? {inputHash} : {})}
  }
}
