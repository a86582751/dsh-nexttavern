/** Unapplied pure consumer-data resolver. These descriptors prove only their
 * own consistency; Root must still obtain actual rows/pointer and Native owner.
 * No table reads/writes, activation, evaluator, cache or capability lives here. */
import {recordSha256, sha256} from './roleplay-data.js'
import {cloneRoleplayTavernLoreDataV1} from './roleplay-tavern-lore-data.js'
import type {DecodedTavernCard} from './tavern-card.js'
import {assertImportRecordIntegrity, assertAssignmentBudget, assertReferenceBudget,
  assertReviewProof, importCoverage, normalizeSourceSpans, projectStructuredImport,
  sourceDescriptor, spanText, validateAssignmentIdentities,hasIndependentAuthorCoreV1,readStructuredImportDataV1} from './roleplay-import-record.js'
import type {ImportRecord, ImportAssignment, ImportPointer, SourceSpan, SourceDescriptor}
  from './roleplay-import-types.js'
import type {TavernLoreContributionInputV1} from './roleplay-tavern-lore-source-types.js'

export const LEGACY_CONTRIBUTION_DATA_BOUNDS = Object.freeze({bytes:16_777_216, nodes:131_072, depth:66})
export interface LegacyRowRefDataV1 {
  readonly table: 'branch' | 'rules' | 'worldbook'
  readonly key: string
  readonly exists: boolean
  readonly sha256: string
}
export interface LegacyCurrentRowDataV1 {
  readonly ref: LegacyRowRefDataV1
  readonly value: Readonly<Record<string, unknown>>
}
export interface LegacyRawEntryDataRefV1 {
  readonly sessionId: string
  readonly sourceRecordSessionId: string
  readonly importId: string
  readonly activePointerSha256: string
  readonly importRecordSha256: string
  readonly rawSha256: string
  readonly normalizedSha256: string
  readonly coverageSha256: string
  readonly transactionId: string
  readonly normalizer: 'tavern-fields-v1' | 'tavern-fields-v2' | 'nexttavern-fields-v1'
  readonly bookPointer: string
  readonly bookSha256: string
  readonly entryPointer: string
  readonly entryOrdinal: number
  readonly entrySha256: string
}
export interface LegacyContributionDataRequestV1 {
  readonly sessionId: string
  readonly sourceRecordSessionId: string
  readonly normalizer: 'tavern-fields-v1' | 'tavern-fields-v2' | 'nexttavern-fields-v1'
  readonly rawDecoded: DecodedTavernCard
  readonly activeImport: ImportRecord
  readonly importRecordRef: LegacyRowRefDataV1
  readonly activePointer: ImportPointer
  readonly activePointerRef: LegacyRowRefDataV1
  readonly currentRules: LegacyCurrentRowDataV1
  /** Complete current own-session worldbook membership supplied by Root. */
  readonly currentWorldbook: readonly LegacyCurrentRowDataV1[]
  readonly currentWorldbookMembershipSha256: string
  /** Explicit consumer selection; raw constant does not imply activation. */
  readonly suppressRawEntryPointers: readonly string[]
  readonly suppressAlwaysOnRowKeys: readonly string[]
}
export type LegacyContributionUnprovenCode = 'INPUT_DATA_UNSUPPORTED' | 'INPUT_DATA_BUDGET'
  | 'IMPORT_RECORD_INVALID' | 'IMPORT_RECORD_REF_CHANGED' | 'ACTIVE_POINTER_REF_CHANGED'
  | 'RAW_DECODED_CHANGED' | 'NORMALIZER_CHANGED' | 'MERGE_UNPROVEN' | 'COVERAGE_UNPROVEN'
  | 'ASSIGNMENT_SPANS_NONCANONICAL' | 'ASSIGNMENT_HASH_CHANGED' | 'SECONDARY_CORE_UNPROVEN'
  | 'CURRENT_RULES_REF_CHANGED' | 'CORE_SOURCE_DESCRIPTORS_CHANGED' | 'CURRENT_CORE_EDIT_UNMAPPED'
  | 'RAW_ENTRY_PROJECTION_UNPROVEN' | 'SUPPRESSION_TARGET_UNPROVEN'
  | 'CURRENT_WORLDBOOK_REF_CHANGED' | 'CURRENT_WORLDBOOK_MEMBERSHIP_CHANGED'
  | 'CURRENT_ENTRY_LINK_UNPROVEN' | 'DIRECT_ALWAYS_ON_ROW_UNPROVEN'
export interface LegacySourceFragmentDataV1 {
  readonly assignmentOrdinal: number
  readonly fragmentOrdinal: number
  readonly span: SourceSpan
  readonly sourceDescriptorSha256: string
  readonly textSha256: string
}
export interface LegacySuppressedEntryDataV1 {
  readonly rawEntry: LegacyRawEntryDataRefV1
  readonly wholeEntrySpan: SourceSpan
  readonly wholeEntryTextSha256: string
  readonly fragments: readonly LegacySourceFragmentDataV1[]
}
export interface LegacyPrimaryBookAbsenceDataV1 {
  readonly binding:'proven-absence'
  readonly bookPointer:'/data/character_book'
  readonly documentSha256:string
  readonly dataSha256:string
  readonly activePointerRef:LegacyRowRefDataV1
  readonly importRecordRef:LegacyRowRefDataV1
  readonly activationSha256:string
  readonly absenceDataSha256:string
}
export interface LegacyDirectRowContributionDataV1 {
  readonly ref: LegacyRowRefDataV1
  readonly content: string
  readonly contentSha256: string
  readonly contributionSha256: string
}
export type LegacyEntryOverlayDataV1 =
  | {readonly kind:'owned-structured-entry';readonly rawEntry:LegacyRawEntryDataRefV1}
  | {readonly kind:'exact-current-row-data'; readonly rawEntry:LegacyRawEntryDataRefV1;
      readonly row:LegacyCurrentRowDataV1; readonly currentContentSha256:string;
      readonly provenanceSha256:string}
  | {readonly kind:'constant-current-overlay-missing'; readonly rawEntry:LegacyRawEntryDataRefV1;
      readonly reason:'NO_INDEPENDENT_LEGACY_CONSTANT_ROW'}
  | {readonly kind:'empty-original-entry'; readonly rawEntry:LegacyRawEntryDataRefV1}
export type LegacyContributionDataResolutionV1 =
  | {readonly schemaVersion:1; readonly kind:'proven-consumer-data';
      readonly rulesRow:LegacyRowRefDataV1; readonly beforeCoreSha256:string;
      readonly afterCoreSha256:string; readonly residualCore:string;
      readonly coreData:{readonly kind:'legacy-projection'|'independent-author'|'legacy-edited-unsplit';readonly text:string};
      readonly orderedBefore:readonly LegacySourceFragmentDataV1[];
      readonly orderedAfter:readonly LegacySourceFragmentDataV1[];
      readonly orderedBeforeSha256:string; readonly orderedAfterSha256:string;
      readonly suppressed:readonly LegacySuppressedEntryDataV1[];
      readonly directAlwaysOn:readonly LegacyDirectRowContributionDataV1[];
      readonly overlays:readonly LegacyEntryOverlayDataV1[];
      readonly worldbookMembershipSha256:string; readonly projectionSha256:string;
      /** Only for an actual structured decoder document with no own book field. */
      readonly primaryBookAbsence?:LegacyPrimaryBookAbsenceDataV1;
      readonly authority:'consumer-data-only'}
  | {readonly schemaVersion:1; readonly kind:'unproven'; readonly code:LegacyContributionUnprovenCode;
      readonly pointer:string; readonly authority:'none'}

class Unproven extends Error {
  constructor(readonly code:LegacyContributionUnprovenCode, readonly pointer:string) {super(code)}
}
function fail(code:LegacyContributionUnprovenCode, pointer:string):never {throw new Unproven(code,pointer)}
const object = (value:unknown):value is Record<string,unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const hash = (value:unknown):value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const same = (left:unknown,right:unknown) => recordSha256(left) === recordSha256(right)
const pointerPart = (key:string) => key.replace(/~/g,'~0').replace(/\//g,'~1')
function freeze<T>(value:T):T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}
function rowMatches(row:LegacyCurrentRowDataV1, table:LegacyRowRefDataV1['table'], key:string):boolean {
  return object(row) && object(row.ref) && object(row.value) && row.ref.table === table && row.ref.key === key
    && row.ref.exists === true && hash(row.ref.sha256) && row.ref.sha256 === recordSha256(row.value)
}
interface IndexedAssignment {assignment:ImportAssignment; ordinal:number; descriptor:SourceDescriptor}
interface Fragment extends LegacySourceFragmentDataV1 {text:string; partIndex:number}
interface EntryBinding {ref:LegacyRawEntryDataRefV1; projectedId:string; constant:boolean;
  enabled:boolean; span:SourceSpan | null}
function sortedAssignments(record:ImportRecord):IndexedAssignment[] {
  return record.assignments.map((assignment,ordinal) => ({assignment,ordinal,descriptor:sourceDescriptor(record,assignment)}))
    .sort((left,right) => {
      const first = left.assignment.sourceSpans[0], second = right.assignment.sourceSpans[0]
      if (!first || !second) fail('ASSIGNMENT_SPANS_NONCANONICAL','/activeImport/assignments')
      return first.startLine - second.startLine || Number(left.assignment.order) - Number(right.assignment.order)
    })
}
function fragmentsFor(record:ImportRecord, assignments:readonly IndexedAssignment[]):Fragment[] {
  return assignments.flatMap((item,partIndex) => item.assignment.sourceSpans.map((span,fragmentOrdinal) => {
    const text = spanText(record,[span])
    return {assignmentOrdinal:item.ordinal, fragmentOrdinal, span, partIndex,
      sourceDescriptorSha256:recordSha256(item.descriptor), textSha256:sha256(text), text}
  })).sort((left,right) => left.span.startLine - right.span.startLine || left.span.endLine - right.span.endLine
    || left.partIndex - right.partIndex || left.fragmentOrdinal - right.fragmentOrdinal)
}
const fragmentData = ({text:_text,...fragment}:Fragment):LegacySourceFragmentDataV1 => ({
  assignmentOrdinal:fragment.assignmentOrdinal, fragmentOrdinal:fragment.fragmentOrdinal, span:fragment.span,
  sourceDescriptorSha256:fragment.sourceDescriptorSha256, textSha256:fragment.textSha256,
})
function validateSource(input:LegacyContributionDataRequestV1):DecodedTavernCard {
  const record = input.activeImport
  if (!object(record) || record.status !== 'active' || !['replace',undefined].includes(record.mode)
    || !['tavern-fields-v1','tavern-fields-v2','nexttavern-fields-v1'].includes(record.normalizer)) {
    if (record?.mode === 'merge') fail('MERGE_UNPROVEN','/activeImport/mode')
    fail('IMPORT_RECORD_INVALID','/activeImport')
  }
  if (input.normalizer !== record.normalizer) fail('NORMALIZER_CHANGED','/normalizer')
  if (record.sessionId !== input.sourceRecordSessionId || input.importRecordRef.table !== 'branch'
    || input.importRecordRef.key !== `${input.sourceRecordSessionId}__import-${record.importId}`
    || input.importRecordRef.exists !== true || input.importRecordRef.sha256 !== recordSha256(record)) {
    fail('IMPORT_RECORD_REF_CHANGED','/importRecordRef')
  }
  try {assertImportRecordIntegrity(record)} catch {fail('IMPORT_RECORD_INVALID','/activeImport')}
  if (!record.sourceEnvelope || !record.activation || !hash(record.rawSha256)) {
    fail('IMPORT_RECORD_INVALID','/activeImport/activation')
  }
  const ruleWrites = Array.isArray(record.activation.writeDigests)
    ? record.activation.writeDigests.filter(item => item.tableName === 'rules'
      && item.key === `${input.sourceRecordSessionId}__spec`) : []
  if (ruleWrites.length !== 1 || !hash(ruleWrites[0]?.sha256)) {
    fail('IMPORT_RECORD_INVALID','/activeImport/activation/writeDigests')
  }
  const pointer = input.activePointer, pointerRef = input.activePointerRef
  if (pointerRef.table !== 'branch' || pointerRef.key !== `${input.sessionId}__import-active`
    || pointerRef.exists !== true || pointerRef.sha256 !== recordSha256(pointer)
    || pointer.importId !== record.importId || pointer.normalizedSha256 !== record.normalizedSha256
    || pointer.transactionId !== record.activation.transactionId
    || (pointer.sourceRecordSessionId ?? input.sessionId) !== input.sourceRecordSessionId) {
    fail('ACTIVE_POINTER_REF_CHANGED','/activePointerRef')
  }
  try {
    assertAssignmentBudget(record.assignments); assertReferenceBudget(record,record.assignments)
    validateAssignmentIdentities(record.assignments)
    if (!record.assignmentProof) assertReviewProof(record)
  } catch {fail('IMPORT_RECORD_INVALID','/activeImport/assignments')}
  for (const [ordinal,assignment] of record.assignments.entries()) {
    let normalized:SourceSpan[]
    try {normalized = normalizeSourceSpans(assignment.sourceSpans,record.lineCount)}
    catch {fail('ASSIGNMENT_SPANS_NONCANONICAL',`/activeImport/assignments/${ordinal}/sourceSpans`)}
    if (!same(normalized,assignment.sourceSpans)) {
      fail('ASSIGNMENT_SPANS_NONCANONICAL',`/activeImport/assignments/${ordinal}/sourceSpans`)
    }
    const digest = sha256(spanText(record,normalized))
    if (assignment.sourceSha256 !== digest || assignment.materializedSha256 !== digest) {
      fail('ASSIGNMENT_HASH_CHANGED',`/activeImport/assignments/${ordinal}`)
    }
  }
  const coverage = importCoverage(record)
  if (coverage.coverage !== 1 || coverage.uncovered.length || coverage.overlaps.length
    || pointer.coverageSha256 !== recordSha256(coverage)
    || record.coverage === undefined || !same(record.coverage,coverage)) fail('COVERAGE_UNPROVEN','/activeImport/coverage')
  const decoded = readStructuredImportDataV1(record).decoded
  if (!same(input.rawDecoded,decoded)) fail('RAW_DECODED_CHANGED','/rawDecoded')
  // Use this fresh decoder result: the bounded data clone detaches aliases, but the
  // original projector uses document.data === data to distinguish its root.
  return decoded
}
function entryBindings(input:LegacyContributionDataRequestV1, decoded:DecodedTavernCard,
  projection:ReturnType<typeof projectStructuredImport>):EntryBinding[] {
  const native=decoded.format==='json-nexttavern-v1'
  const record = input.activeImport
  const book = decoded.data.character_book
  if (!Object.hasOwn(decoded.data,'character_book')) {
    if(projection.worldbook.length)fail('RAW_ENTRY_PROJECTION_UNPROVEN','/rawDecoded/data/character_book')
    return []
  }
  if (!object(book)) fail('RAW_ENTRY_PROJECTION_UNPROVEN','/rawDecoded/data/character_book')
  const entries = book.entries ?? []
  if (!object(entries) && !Array.isArray(entries)) fail('RAW_ENTRY_PROJECTION_UNPROVEN','/rawDecoded/data/character_book/entries')
  const root = decoded.document.data === decoded.data ? '/data' : '', bookPointer = `${root}/character_book`
  // Replay the same legacy projector on an inert prefix view. Only the entry
  // list is absent from data; the original document/card id/archive stays exact.
  // Count structural assignments, never locate entry content by text search.
  const prefixDecoded:DecodedTavernCard = {...decoded,data:{...decoded.data,character_book:{...book,entries:[]}}}
  const prefix = projectStructuredImport(record,prefixDecoded)
  // Schema 6 omits the transport archive from its execution projection. Old
  // native/schema 4 spans retain their final full-document/archive assignment.
  const trailingArchive=native?record.schemaVersion!==6:record.normalizer==='tavern-fields-v1'
  let projectionOrdinal = prefix.assignments.length - (trailingArchive ? 1 : 0)
  const bindings:EntryBinding[] = []
  for (const [entryOrdinal,[entryKey,raw]] of Object.entries(entries).entries()) {
    const projected = projection.worldbook[entryOrdinal]
    if (!object(raw) || typeof raw.content !== 'string' || !projected || projected.sourceIndex !== entryOrdinal) {
      fail('RAW_ENTRY_PROJECTION_UNPROVEN',`${bookPointer}/entries/${pointerPart(entryKey)}`)
    }
    let span:SourceSpan | null = null
    if (raw.content !== '') {
      const assignment = projection.assignments[projectionOrdinal++]
      const first = assignment?.sourceSpans[0]
      if (!assignment || assignment.sourceSpans.length !== 1 || !first
        || assignment.target !== (native?'archive-only':projected.constant && projected.enabled ? 'core-setting' : 'worldbook')
        || (native||!projected.constant || !projected.enabled) && assignment.id !== projected.id) {
        fail('RAW_ENTRY_PROJECTION_UNPROVEN',`${bookPointer}/entries/${pointerPart(entryKey)}`)
      }
      span = first
    }
    bindings.push({projectedId:projected.id,constant:projected.constant,enabled:projected.enabled,span,
      ref:{sessionId:input.sessionId,sourceRecordSessionId:input.sourceRecordSessionId,importId:record.importId,
        activePointerSha256:input.activePointerRef.sha256,importRecordSha256:input.importRecordRef.sha256,
        rawSha256:record.rawSha256,normalizedSha256:record.normalizedSha256,coverageSha256:input.activePointer.coverageSha256!,
        transactionId:record.activation!.transactionId,normalizer:input.normalizer,bookPointer,bookSha256:recordSha256(book),
        entryPointer:`${bookPointer}/entries/${pointerPart(entryKey)}`,entryOrdinal,entrySha256:recordSha256(raw)}})
  }
  const expectedEnd = projection.assignments.length - (trailingArchive ? 1 : 0)
  if (projectionOrdinal !== expectedEnd) fail('RAW_ENTRY_PROJECTION_UNPROVEN',bookPointer)
  return bindings
}
const overlaps = (left:SourceSpan,right:SourceSpan) => left.startLine <= right.endLine && right.startLine <= left.endLine
function suppressedEntry(record:ImportRecord, binding:EntryBinding, fragments:readonly Fragment[]):LegacySuppressedEntryDataV1 {
  const span = binding.span
  if (!binding.constant || !binding.enabled || !span) fail('SUPPRESSION_TARGET_UNPROVEN',binding.ref.entryPointer)
  const relevant = fragments.filter(fragment => overlaps(fragment.span,span))
  let next = span.startLine
  for (const fragment of relevant) {
    const start = Math.max(fragment.span.startLine,span.startLine), end = Math.min(fragment.span.endLine,span.endLine)
    if (start !== next) fail('SUPPRESSION_TARGET_UNPROVEN',binding.ref.entryPointer)
    next = end + 1
  }
  if (next !== span.endLine + 1) fail('SUPPRESSION_TARGET_UNPROVEN',binding.ref.entryPointer)
  return {rawEntry:binding.ref,wholeEntrySpan:span,wholeEntryTextSha256:sha256(spanText(record,[span])),
    fragments:relevant.map(fragmentData)}
}
function residualFragments(record:ImportRecord, fragments:readonly Fragment[], suppressed:readonly LegacySuppressedEntryDataV1[]):Fragment[] {
  const result:Fragment[] = []
  for (const fragment of fragments) {
    let next = fragment.span.startLine
    for (const item of suppressed) {
      const cut = item.wholeEntrySpan
      if (!overlaps(fragment.span,cut)) continue
      if (next < cut.startLine) {
        const span = {startLine:next,endLine:cut.startLine - 1}, text = spanText(record,[span])
        result.push({...fragment,span,text,textSha256:sha256(text)})
      }
      next = Math.max(next,cut.endLine + 1)
    }
    if (next <= fragment.span.endLine) {
      const span = {startLine:next,endLine:fragment.span.endLine}, text = spanText(record,[span])
      result.push({...fragment,span,text,textSha256:sha256(text)})
    }
  }
  return result
}
function overlays(input:LegacyContributionDataRequestV1, bindings:readonly EntryBinding[], assignments:readonly IndexedAssignment[]):LegacyEntryOverlayDataV1[] {
  return bindings.map<LegacyEntryOverlayDataV1>(binding => {
    if(input.rawDecoded.format==='json-nexttavern-v1')return {kind:'owned-structured-entry',rawEntry:binding.ref}
    if (!binding.span) return {kind:'empty-original-entry',rawEntry:binding.ref}
    if (binding.constant && binding.enabled) {
      return {kind:'constant-current-overlay-missing',rawEntry:binding.ref,reason:'NO_INDEPENDENT_LEGACY_CONSTANT_ROW'}
    }
    const pieces = assignments.filter(item => item.assignment.target === 'worldbook'
      && item.assignment.id === binding.projectedId)
    const key = `${input.sessionId}__${binding.projectedId}`
    const current = input.currentWorldbook.find(row => row.ref.key === key)
    if (!current || !pieces.length || !same(pieces.flatMap(item => item.assignment.sourceSpans),[binding.span])
      || !same(current.value.sources,pieces.map(item => item.descriptor)) || current.value.id !== binding.projectedId
      || typeof current.value.content !== 'string') fail('CURRENT_ENTRY_LINK_UNPROVEN',binding.ref.entryPointer)
    return {kind:'exact-current-row-data',rawEntry:binding.ref,row:current,
      currentContentSha256:sha256(current.value.content),provenanceSha256:recordSha256(current.value.sources)}
  })
}
function directRow(input:{sessionId:string; row:LegacyCurrentRowDataV1}):LegacyDirectRowContributionDataV1 {
  const {row,sessionId} = input
  if (!rowMatches(row,'worldbook',row.ref.key) || !row.ref.key.startsWith(`${sessionId}__`)
    || row.value.enabled === false || row.value.alwaysOn !== true || typeof row.value.content !== 'string') {
    fail('DIRECT_ALWAYS_ON_ROW_UNPROVEN','/row')
  }
  const body = {ref:row.ref,content:row.value.content,contentSha256:sha256(row.value.content)}
  return {...body,contributionSha256:recordSha256(body)}
}
export function resolveDirectAlwaysOnContributionDataV1(input:{sessionId:string;row:LegacyCurrentRowDataV1}) {
  try {
    const captured = cloneRoleplayTavernLoreDataV1(input,LEGACY_CONTRIBUTION_DATA_BOUNDS.bytes,LEGACY_CONTRIBUTION_DATA_BOUNDS)
    return freeze({schemaVersion:1 as const,kind:'direct-row-consumer-data' as const,
      contribution:directRow(captured),authority:'consumer-data-only' as const})
  } catch (error) {return refusal(error)}
}
function refusal(error:unknown):Extract<LegacyContributionDataResolutionV1,{kind:'unproven'}> {
  return freeze({schemaVersion:1 as const,kind:'unproven' as const,
    code:error instanceof Unproven ? error.code : error instanceof Error && error.message==='LORE_DATA_BUDGET'
      ? 'INPUT_DATA_BUDGET' : 'INPUT_DATA_UNSUPPORTED',pointer:error instanceof Unproven ? error.pointer : '',authority:'none' as const})
}
export function resolveLegacyContributionDataV1(request:LegacyContributionDataRequestV1):LegacyContributionDataResolutionV1 {
  try {
    const input = cloneRoleplayTavernLoreDataV1(request,LEGACY_CONTRIBUTION_DATA_BOUNDS.bytes,LEGACY_CONTRIBUTION_DATA_BOUNDS)
    const decoded = validateSource(input)
    if (!rowMatches(input.currentRules,'rules',`${input.sessionId}__spec`)) fail('CURRENT_RULES_REF_CHANGED','/currentRules/ref')
    const keys = new Set<string>()
    for (const row of input.currentWorldbook) {
      if (!rowMatches(row,'worldbook',row.ref.key) || !row.ref.key.startsWith(`${input.sessionId}__`) || keys.has(row.ref.key)) {
        fail('CURRENT_WORLDBOOK_REF_CHANGED','/currentWorldbook')
      }
      keys.add(row.ref.key)
    }
    const membership = Object.fromEntries(input.currentWorldbook.map(row => [row.ref.key,row.ref.sha256]))
    if (recordSha256(membership) !== input.currentWorldbookMembershipSha256) {
      fail('CURRENT_WORLDBOOK_MEMBERSHIP_CHANGED','/currentWorldbookMembershipSha256')
    }
    return computeLegacyContributionData(input,decoded)
  } catch (error) {return refusal(error)}
}
/** Source owns the captured import, decoder and actual-row admission. Only
 * this consumer's suppression choices and contribution semantics are new.
 * The result is explanatory DATA, never a write or execution capability. */
export function resolveCapturedLegacyContributionDataV1(input:TavernLoreContributionInputV1,
  selection:Pick<LegacyContributionDataRequestV1,'suppressRawEntryPointers'|'suppressAlwaysOnRowKeys'>)
  :LegacyContributionDataResolutionV1 {
  try {return computeLegacyContributionData({...input,...selection},input.rawDecoded)}
  catch(error) {return refusal(error)}
}
function computeLegacyContributionData(input:LegacyContributionDataRequestV1,decoded:DecodedTavernCard)
  :Extract<LegacyContributionDataResolutionV1,{kind:'proven-consumer-data'}> {
    const record=input.activeImport
    const rules = input.currentRules.value
    if (typeof rules.core !== 'string' || !object(rules.sources) || !Array.isArray(rules.sources.core)) {
      fail('CORE_SOURCE_DESCRIPTORS_CHANGED','/currentRules/value/sources/core')
    }
    const assignments = sortedAssignments(record), core = assignments.filter(item => item.assignment.target === 'core-setting')
    if (core.some(item => item.assignment.secondary === true)) fail('SECONDARY_CORE_UNPROVEN','/activeImport/assignments')
    if (!same(rules.sources.core,core.map(item => item.descriptor))) {
      fail('CORE_SOURCE_DESCRIPTORS_CHANGED','/currentRules/value/sources/core')
    }
    const before = fragmentsFor(record,core), originalCore = before.map(fragment => fragment.text).join('')
    const independent=decoded.format==='json-nexttavern-v1'||hasIndependentAuthorCoreV1(rules)
    const coreKind=independent?'independent-author':rules.core===originalCore?'legacy-projection':'legacy-edited-unsplit'
    const projection=projectStructuredImport(record,decoded),bindings = entryBindings(input,decoded,projection),
      selected = new Set<string>(), suppressed:LegacySuppressedEntryDataV1[] = []
    // Only a still-identical legacy mixture has source spans in the live core.
    // Independent author text and historical unsplit edits are never cut using
    // positions from an older projection; the book/journal remains readable.
    for (const pointer of coreKind==='legacy-projection'?input.suppressRawEntryPointers:[]) {
      const binding = bindings.find(item => item.ref.entryPointer === pointer)
      if (!binding || selected.has(pointer)) fail('SUPPRESSION_TARGET_UNPROVEN',pointer)
      selected.add(pointer); suppressed.push(suppressedEntry(record,binding,before))
    }
    suppressed.sort((left,right) => left.wholeEntrySpan.startLine - right.wholeEntrySpan.startLine)
    const after = residualFragments(record,before,suppressed), residualCore = coreKind==='legacy-projection'
      ?after.map(fragment => fragment.text).join(''):rules.core
    const selectedRows = new Set<string>(), directAlwaysOn:LegacyDirectRowContributionDataV1[] = []
    for (const key of input.suppressAlwaysOnRowKeys) {
      const row = input.currentWorldbook.find(item => item.ref.key === key)
      if (!row || selectedRows.has(key)) fail('DIRECT_ALWAYS_ON_ROW_UNPROVEN',key)
      selectedRows.add(key); directAlwaysOn.push(directRow({sessionId:input.sessionId,row}))
    }
    const orderedBefore = before.map(fragmentData), orderedAfter = after.map(fragmentData)
    let primaryBookAbsence:LegacyPrimaryBookAbsenceDataV1|undefined
    if(['json-v2','json-v3','png-v2','png-v3','json-nexttavern-v1'].includes(decoded.format)
      &&decoded.document.data===decoded.data&&!Object.hasOwn(decoded.data,'character_book')) {
      const absence={binding:'proven-absence' as const,bookPointer:'/data/character_book' as const,
        documentSha256:recordSha256(decoded.document),dataSha256:recordSha256(decoded.data),
        activePointerRef:input.activePointerRef,importRecordRef:input.importRecordRef,
        activationSha256:recordSha256(record.activation)}
      primaryBookAbsence={...absence,absenceDataSha256:recordSha256(absence)}
    }
    return freeze({schemaVersion:1 as const,kind:'proven-consumer-data' as const,rulesRow:input.currentRules.ref,
      beforeCoreSha256:sha256(rules.core),afterCoreSha256:sha256(residualCore),residualCore,
      coreData:{kind:coreKind,text:residualCore},
      orderedBefore,orderedAfter,orderedBeforeSha256:recordSha256(orderedBefore),orderedAfterSha256:recordSha256(orderedAfter),
      suppressed,directAlwaysOn,overlays:overlays(input,bindings,assignments),worldbookMembershipSha256:input.currentWorldbookMembershipSha256,
      projectionSha256:recordSha256(projection),
      ...(primaryBookAbsence?{primaryBookAbsence}:{}),authority:'consumer-data-only' as const})
}
