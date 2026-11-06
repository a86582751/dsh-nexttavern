/** Native-owned pure request-material planning and historical reconstruction.
 * Data descriptors do not grant live Session/Agent or Source authority. */
import {createHash} from 'node:crypto'
import {types as utilTypes} from 'node:util'
import {brandString} from '@deepseek-ai/dsh-brand'
import type {Message,RequestMaterialMessageV1,RequestMessageTextProjectionV2,RequestProjectedMessageV1} from 'dsh-nexttavern-native-llm'
import {deepFreeze} from '@deepseek-ai/dsh-util-values'
import {nativeInputSha256} from './input-admission.js'
import {createSurfaceCursor, deriveEventMessage, foldSurface} from 'dsh-nexttavern-native-session/surface'
import type {SessionMessageProjection} from 'dsh-nexttavern-native-session/surface'
import type {NativeMaterialSelectedBaseV1,NativeMaterialTextSurfaceV1} from './request-material-owner.js'
import {validateNativeMaterialFinalTextProjectionV1} from 'dsh-nexttavern-native-session/request-material'
import type {Session,SessionEvent, SessionSeq,NativeLoreRoleV1,NativeMaterialDataRefV1,NativeMaterialMessageRefV1,
  NativeMaterialInsertionV1,NativeMaterialPlacementV1,
  NativeRequestMaterialRecord,NativeRequestMaterialRecordV1,NativeMessageProjectionV1,
  NativeMaterialMessageTextEditV2,NativeMaterialMessageTextProjectionV2,
  NativeMaterialFinalTextProjectionV1,NativeMaterialTextOutputV1} from 'dsh-nexttavern-native-session'
export type {NativeLoreRoleV1,NativeMaterialDataRefV1,NativeMaterialMessageRefV1,NativeMaterialInsertionV1,
  NativeMaterialPlacementV1,NativeRequestMaterialRecordV1,NativeRequestMaterialRecordV2,NativeRequestMaterialRecord,
  NativeMaterialMessageTextEditV2,NativeMaterialMessageTextProjectionV2} from 'dsh-nexttavern-native-session'

export const NATIVE_REQUEST_MATERIAL_LIMITS_V1 = Object.freeze({
  baseMessages: 4096, insertions: 128, textChars: 65536, renderedBytes: 1048576,
  depth: 4096, dataBytes: 16777216, dataNodes: 131072, dataDepth: 64,
  prefixEvents: 65536, reconstructionFoldEvents: 131072,
})
export type NativeRequestMaterialMessageV1=RequestMaterialMessageV1
/** Existing SystemMessage/AssistantMessage close source types. Host must explicitly
 * adopt this request-only union; do not pretend these are persisted Messages. */
export type NativeRequestMessageV1 = Message | NativeRequestMaterialMessageV1
  | RequestMessageTextProjectionV2 | RequestProjectedMessageV1
export interface NativeRequestMaterialPlanInputV1 {
  readonly turn: number
  readonly step: number
  readonly header: {readonly seq: number; readonly sha256: string}
  readonly snapshot: NativeMaterialDataRefV1
  readonly plan: NativeMaterialDataRefV1
  readonly boundarySeq: number
  readonly contentGeneration: number
  readonly surfaceNodes: readonly number[]
  readonly baseMessages: readonly Message[]
  readonly baseRefs: readonly NativeMaterialMessageRefV1[]
  readonly protectedPrefixLength: number
  readonly insertions: readonly NativeMaterialInsertionV1[]
  readonly messageProjection?: NativeMessageProjectionV1
  readonly requestLocalSampling?: NativeRequestMaterialRecordV1['delta']['requestLocalSampling']
  readonly finalTextProjection?:NativeMaterialFinalTextProjectionV1
}
export interface NativeRequestMaterialPlanInputV2 extends NativeRequestMaterialPlanInputV1 {
  readonly messageTextProjections:readonly NativeMaterialMessageTextProjectionV2[]
}
export type NativeMaterialStructureInputV1=Omit<NativeRequestMaterialPlanInputV1,'snapshot'|'plan'|'finalTextProjection'>
  &{readonly messageTextProjections?:readonly NativeMaterialMessageTextProjectionV2[]}
type StructureRow={
  readonly role:Message['role'];readonly content:NativeRequestMessageV1['content'];
  readonly provenance:NativeMaterialTextSurfaceV1['slots'][number]['provenance'];
  seal(inputSha:string,content:NativeRequestMessageV1['content']):NativeRequestMessageV1
}
export interface NativeRequestMaterialEventV1 {
  readonly type: 'request/material'
  readonly seq: number
  readonly time: number
  readonly data: NativeRequestMaterialRecord
  /** Required semantic record: never ignorable, never a surface event. */
  readonly ignorable?: never
  readonly surfaceOp?: never
  readonly sourceEventSeqs?: never
}
export interface NativeRequestMaterialResultV1 {
  readonly record: NativeRequestMaterialRecord
  readonly messages: readonly NativeRequestMessageV1[]
}
export type NativeRequestMaterialFailureCodeV1 =
  | 'DATA_UNSAFE' | 'DATA_LIMIT' | 'MALFORMED' | 'UNKNOWN_VERSION'
  | 'BASE_MISMATCH' | 'BOUNDARY_MISMATCH' | 'HEADER_MISMATCH'
  | 'INSERTION_MISMATCH' | 'TOOL_GROUP_UNSUPPORTED' | 'TOOL_GROUP_SPLIT'
  | 'MATERIAL_MISMATCH' | 'SURFACE_RECONSTRUCTION_FAILED'
  | 'PROJECTION_MISMATCH' | 'PROJECTION_BOUNDARY'
export class NativeRequestMaterialFailure extends Error {
  constructor(readonly code: NativeRequestMaterialFailureCodeV1, readonly location: string) {
    super(`native request material ${code} at ${location}`)
    this.name = 'NativeRequestMaterialFailure'
  }
}
type Data = null | boolean | number | string | Data[] | {[key: string]: Data}
type Obj = {[key: string]: Data}
const limits = NATIVE_REQUEST_MATERIAL_LIMITS_V1
function fail(code: NativeRequestMaterialFailureCodeV1, location: string): never {
  throw new NativeRequestMaterialFailure(code, location)
}
const safeInt = (value: unknown, max = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
  && value <= max && !Object.is(value, -0)
const sha = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const identity = (value: unknown): value is string => typeof value === 'string'
  && value.length > 0 && value.length <= 256 && value === value.trim()
  && !/[\u0000-\u001f\u007f-\u009f]/.test(value)

/** Descriptor traversal precedes all reads. isProxy runs before reflection, so
 * neither proxy traps nor getters run. Prefix mode validates without copying
 * history; its recursively frozen data may be borrowed by canonical fold. */
function ownedData(value: unknown, location: string, copy = true, requireFrozen = false): Data {
  let nodes = 0
  let bytes = 0
  const ancestors = new Set<object>()
  const visit = (item: unknown, depth: number, where: string): Data => {
    if (++nodes > limits.dataNodes || depth > limits.dataDepth) fail('DATA_LIMIT', where)
    if (item === null || typeof item === 'boolean') return item
    if (typeof item === 'string') {
      bytes += Buffer.byteLength(item, 'utf8')
      if (bytes > limits.dataBytes) fail('DATA_LIMIT', where)
      return item
    }
    if (typeof item === 'number' && Number.isFinite(item) && !Object.is(item, -0)) return item
    if (typeof item !== 'object' || item === null || utilTypes.isProxy(item)) fail('DATA_UNSAFE', where)
    if (ancestors.has(item)) fail('DATA_UNSAFE', where)
    const proto = Object.getPrototypeOf(item)
    const array = Array.isArray(item)
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) fail('DATA_UNSAFE', where)
    if (requireFrozen && !Object.isFrozen(item)) fail('DATA_UNSAFE', where)
    if (array && !safeInt(Object.getOwnPropertyDescriptor(item, 'length')?.value, limits.prefixEvents)) {
      fail('DATA_LIMIT', where)
    }
    const descriptors = Object.getOwnPropertyDescriptors(item)
    const keys = Reflect.ownKeys(descriptors)
    if (keys.some(key => typeof key !== 'string')) fail('DATA_UNSAFE', where)
    ancestors.add(item)
    if (array) {
      const length = descriptors['length']?.value as unknown
      if (!safeInt(length, limits.prefixEvents) || keys.length !== length + 1) fail('DATA_LIMIT', where)
      const result: Data[] = []
      for (let index = 0; index < length; index++) {
        const descriptor = descriptors[String(index)]
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) fail('DATA_UNSAFE', where)
        const entry = visit(descriptor.value, depth + 1, `${where}[${index}]`)
        if (copy) result.push(entry)
      }
      ancestors.delete(item)
      return copy ? Object.freeze(result) as Data[] : item as Data[]
    }
    const result: Obj = Object.create(null) as Obj
    for (const key of keys as string[]) {
      const descriptor = descriptors[key]
      if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) fail('DATA_UNSAFE', where)
      bytes += Buffer.byteLength(key, 'utf8')
      if (bytes > limits.dataBytes) fail('DATA_LIMIT', where)
      const entry = visit(descriptor.value, depth + 1, `${where}.${key}`)
      if (copy) result[key] = entry
    }
    ancestors.delete(item)
    return copy ? Object.freeze(result) as Obj : item as Obj
  }
  return visit(value, 0, location)
}
function object(value: Data, fields: readonly string[], location: string): Obj {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('MALFORMED', location)
  const keys = Object.keys(value)
  if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) fail('MALFORMED', location)
  return value
}
function list(value: Data | undefined, max: number, location: string): Data[] {
  if (!Array.isArray(value) || value.length > max) fail('DATA_LIMIT', location)
  return value
}
function ref(value: Data | undefined, location: string): void {
  const item = object(value as Data, ['key', 'sha256'], location)
  if (!identity(item['key']) || !sha(item['sha256'])) fail('MALFORMED', location)
}
function canonical(value: Data): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort()
    .map(key => `${JSON.stringify(key)}:${canonical(value[key] as Data)}`).join(',')}}`
  return JSON.stringify(value) ?? fail('MALFORMED', 'canonical')
}
/** Data digest only. It neither creates a Native receipt nor proves ownership. */
export function nativeRequestMaterialSha256V1(value: unknown): string {
  return digest(ownedData(value, 'hash'))
}
function digest(value: Data): string {
  return createHash('sha256').update(canonical(value), 'utf8').digest('hex')
}
function same(left: unknown, right: unknown): boolean {
  return canonical(left as Data) === canonical(right as Data)
}
/** Cold DATA reconstruction only. The initial cut precedes material's planned
 * appends, so its recovery cannot depend on the later request/material record. */
export function reconstructNativeMaterialSelectedCaptureV2(raw:unknown,events:readonly SessionEvent[],
  projections:readonly SessionMessageProjection[]=[]):NativeMaterialSelectedBaseV1 {
  const capture=object(ownedData(raw,'selectedCapture'),
    ['schemaVersion','encoding','sessionId','boundarySeq','selectedSha256','pendingMessages'],'selectedCapture')
  if(capture['schemaVersion']!==2||capture['encoding']!=='native-selected-capture-v2'
    ||!identity(capture['sessionId'])||!safeInt(capture['boundarySeq'])||!sha(capture['selectedSha256']))
    fail('MALFORMED','selectedCapture')
  const length=Number(capture['boundarySeq'])+1
  if(length>events.length)fail('BOUNDARY_MISMATCH','selectedCapture.boundarySeq')
  const prefix=events.slice(0,length)
  let folded:ReturnType<typeof foldSurface>
  try{folded=foldSurface(prefix,projections)}catch{fail('SURFACE_RECONSTRUCTION_FAILED','selectedCapture.fold')}
  const messages:NativeMaterialSelectedBaseV1['messages'][number][]=[]
  for(const seq of folded.nodes) {
    const message=deriveEventMessage(prefix[Number(seq)]!,folded.projectedMessages)
    if(message===null)continue
    const owned=ownedData(message,'selectedCapture.surfaceMessage') as unknown as Message
    messages.push(Object.freeze({origin:'surface',eventSeq:Number(seq),id:String(owned.id),role:owned.role,
      messageSha256:nativeInputSha256(owned),message:owned}))
  }
  for(const pending of list(capture['pendingMessages'],limits.baseMessages,'selectedCapture.pendingMessages')) {
    validateMessage(pending,'selectedCapture.pendingMessage')
    const message=pending as unknown as Message
    messages.push(Object.freeze({origin:'pending-decision',eventSeq:null,id:String(message.id),role:message.role,
      messageSha256:nativeInputSha256(message),message}))
  }
  const data={contentGeneration:folded.contentGeneration,boundarySeq:length-1,
    surfaceNodes:Object.freeze([...folded.nodes].map(Number)),messages:Object.freeze(messages)},
    sha256=nativeInputSha256({...data,messages:messages.map(({message:_message,...ref})=>ref)})
  if(sha256!==capture['selectedSha256'])fail('BASE_MISMATCH','selectedCapture.selectedSha256')
  return Object.freeze({...data,sha256})
}
function canonicalMessageTextProjections(raw:readonly NativeMaterialMessageTextProjectionV2[]) {
  list(raw as unknown as Data,limits.baseMessages,'messageTextProjections')
  let bytes=0
  const targets=new Set<string>()
  for(const projection of raw) {
    object(projection as unknown as Data,['target','textEdits','projectionSha256'],'projection')
    const target=object(projection.target as unknown as Data,['id','role','messageSha256'],'projection.target')
    if(!identity(target['id'])||targets.has(target['id'])||!['user','assistant'].includes(String(target['role']))
      ||!sha(target['messageSha256'])||!sha(projection.projectionSha256))fail('MALFORMED','projection.target')
    targets.add(target['id'])
    const edits=list(projection.textEdits as unknown as Data,4096,'projection.textEdits'),indices=new Set<number>()
    if(!edits.length)fail('MALFORMED','projection.textEdits')
    for(const rawEdit of edits) {
      const edit=object(rawEdit,['blockIndex','replacementText'],'projection.textEdit')
      if(!safeInt(edit['blockIndex'],4095)||indices.has(edit['blockIndex'])||typeof edit['replacementText']!=='string'
        ||!edit['replacementText'].isWellFormed()||edit['replacementText'].length>limits.textChars)
        fail('MALFORMED','projection.textEdit')
      indices.add(edit['blockIndex'])
      bytes+=Buffer.byteLength(edit['replacementText'],'utf8')
      if(bytes>limits.renderedBytes)fail('DATA_LIMIT','projection.textEdits')
    }
  }
  return raw
}
/** One shared pure projection for the Core producer and Native reconstruction.
 * Unchanged input retains its original identity and provider replay envelope. */
export function projectNativeMessageTextV2(message:Message,
  textEdits:readonly NativeMaterialMessageTextEditV2[]):Message|RequestMessageTextProjectionV2 {
  if(message.role!=='user'&&message.role!=='assistant')fail('BASE_MISMATCH','projection.role')
  const replacements=new Map<number,string>()
  for(const edit of textEdits) {
    if(!safeInt(edit.blockIndex,message.content.length-1)||replacements.has(edit.blockIndex)
      ||message.content[edit.blockIndex]?.type!=='text'||typeof edit.replacementText!=='string'
      ||!edit.replacementText.isWellFormed())fail('BASE_MISMATCH','projection.textEdits')
    replacements.set(edit.blockIndex,edit.replacementText)
  }
  let changed=false
  const content=message.content.map((block,index)=>{
    const replacement=replacements.get(index)
    if(block.type!=='text'||replacement===undefined||replacement===block.text)return block
    changed=true
    return {...block,text:replacement}
  })
  if(!changed)return message
  if(message.role==='user')return deepFreeze({...message,content})
  const target={id:String(message.id),role:'assistant' as const,messageSha256:nativeInputSha256(message)},
    textEditsSha256=nativeInputSha256(textEdits)
  return deepFreeze({id:brandString<Message['id']>(`native-message-projection-${nativeInputSha256({target,textEdits})}`),
    role:'assistant',content,source:{kind:'request-material-projection',schemaVersion:2,
      encoding:'native-request-message-text-projection-v2',target,textEditsSha256}})
}
function validateMessage(value: Data, location: string): Message {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail('MALFORMED', location)
  if (!identity(value['id']) || !['system', 'developer', 'user', 'assistant', 'tool'].includes(value['role'] as string)
    || !Array.isArray(value['content']) || value['source'] === null
    || typeof value['source'] !== 'object' || Array.isArray(value['source'])) fail('MALFORMED', location)
  const source = value['source'] as Obj
  if (!identity(source['kind']) || source['kind'] === 'request-material') fail('BASE_MISMATCH', location)
  for (const block of value['content']) {
    if (block === null || typeof block !== 'object' || Array.isArray(block) || !identity(block['type'])) {
      fail('MALFORMED', `${location}.content`)
    }
  }
  if (value['role'] === 'tool' && (source['kind'] !== 'tool' || !identity(source['callId'])
    || value['toolCallId'] !== source['callId'])) fail('MALFORMED', location)
  return value as unknown as Message
}
function validateBase(input: NativeMaterialStructureInputV1): void {
  if (!safeInt(input.turn) || input.turn<1 || !safeInt(input.step) || input.step<1 || !safeInt(input.boundarySeq)
    || !safeInt(input.contentGeneration) || !safeInt(input.protectedPrefixLength, input.baseMessages.length)
    || !safeInt(input.header.seq, input.boundarySeq) || !sha(input.header.sha256)) fail('MALFORMED', 'base.metadata')
  if (input.baseMessages.length > limits.baseMessages || input.surfaceNodes.length > limits.baseMessages
    || input.baseRefs.length !== input.baseMessages.length) fail('DATA_LIMIT', 'base.messages')
  const nodes = new Set<number>()
  for (const seq of input.surfaceNodes) {
    if (!safeInt(seq, input.boundarySeq) || nodes.has(seq)) fail('BASE_MISMATCH', 'base.surfaceNodes')
    nodes.add(seq)
  }
  const ids = new Set<string>()
  let nodeIndex = 0
  for (const [index, message] of input.baseMessages.entries()) {
    validateMessage(message as unknown as Data, `base.messages[${index}]`)
    const item = input.baseRefs[index]
    if (!item) fail('BASE_MISMATCH', `base.refs[${index}]`)
    object(item as unknown as Data, ['seq', 'id', 'role', 'messageSha256'], `base.refs[${index}]`)
    while (nodeIndex < input.surfaceNodes.length && input.surfaceNodes[nodeIndex] !== item.seq) nodeIndex++
    if (nodeIndex >= input.surfaceNodes.length || ids.has(message.id) || item.id !== message.id
      || item.role !== message.role || !sha(item.messageSha256)
      || item.messageSha256 !== digest(message as unknown as Data)) fail('BASE_MISMATCH', `base.refs[${index}]`)
    ids.add(message.id)
    nodeIndex++
  }
}
function canonicalInsertions(raw: readonly NativeMaterialInsertionV1[]): readonly NativeMaterialInsertionV1[] {
  if (raw.length > limits.insertions) fail('DATA_LIMIT', 'insertions')
  let totalBytes = 0
  const identities = new Set<string>()
  const orders = new Set<number>()
  for (const [index, item] of raw.entries()) {
    object(item as unknown as Data, ['contributionRef', 'sourceSha256', 'renderedText', 'renderedSha256',
      'requestedRole', 'requestedDepth', 'stableOrder'], `insertions[${index}]`)
    if (!identity(item.contributionRef) || !sha(item.sourceSha256) || !sha(item.renderedSha256)
      || typeof item.renderedText !== 'string' || !item.renderedText.trim() || !item.renderedText.isWellFormed()
      || item.renderedText.length > limits.textChars || !['system', 'user', 'assistant'].includes(item.requestedRole)
      || !safeInt(item.requestedDepth, limits.depth) || !safeInt(item.stableOrder)
      || identities.has(item.contributionRef) || orders.has(item.stableOrder)) fail('INSERTION_MISMATCH', `insertions[${index}]`)
    const textSha = createHash('sha256').update(item.renderedText, 'utf8').digest('hex')
    if (item.renderedSha256 !== textSha) fail('INSERTION_MISMATCH', `insertions[${index}].renderedSha256`)
    totalBytes += Buffer.byteLength(item.renderedText, 'utf8')
    if (totalBytes > limits.renderedBytes) fail('DATA_LIMIT', 'insertions.renderedBytes')
    identities.add(item.contributionRef)
    orders.add(item.stableOrder)
  }
  // Locale independent, including historical readers on another OS.
  return [...raw].sort((a, b) => a.stableOrder - b.stableOrder
    || (a.contributionRef < b.contributionRef ? -1 : a.contributionRef > b.contributionRef ? 1 : 0))
}
/** Only the canonical adjacent tool-result group is supported. An orphan,
 * duplicate, missing result or intervening message is not guessed into a group. */
function forbiddenToolBoundaries(base: readonly Message[]): ReadonlySet<number> {
  const forbidden = new Set<number>()
  const globallySeen = new Set<string>()
  for (let index = 0; index < base.length; index++) {
    const message = base[index]
    if (!message) fail('MALFORMED', 'base.toolGroup')
    if (message.role === 'tool') fail('TOOL_GROUP_UNSUPPORTED', `base[${index}]`)
    const calls = message.content.filter(block => block.type === 'tool-call')
    if (calls.length === 0) continue
    if (message.role !== 'assistant') fail('TOOL_GROUP_UNSUPPORTED', `base[${index}]`)
    const pending = new Set<string>()
    for (const call of calls) {
      if (call.type !== 'tool-call' || !identity(call.id) || pending.has(call.id) || globallySeen.has(call.id)) {
        fail('TOOL_GROUP_UNSUPPORTED', `base[${index}].toolCalls`)
      }
      pending.add(call.id)
      globallySeen.add(call.id)
    }
    const callIndex = index
    while (pending.size > 0) {
      index++
      const result = base[index]
      if (!result || result.role !== 'tool' || !pending.delete(result.toolCallId)) {
        fail('TOOL_GROUP_UNSUPPORTED', `base[${callIndex}].results`)
      }
      forbidden.add(index)
    }
  }
  return forbidden
}
function resolveStructure(input:NativeMaterialStructureInputV1) {
  validateBase(input)
  if(input.requestLocalSampling) {
    const local=input.requestLocalSampling
    object(local as unknown as Data,['schemaVersion','base'],'requestLocalSampling')
    if(local.schemaVersion!==1)fail('UNKNOWN_VERSION','requestLocalSampling')
    const base=local.base
    object(base as unknown as Data,['temperature','maxTokens','stop'].filter(key=>Object.hasOwn(base,key)),'requestLocalSampling.base')
    if(base.temperature!==undefined&&!Number.isFinite(base.temperature)
      ||base.maxTokens!==undefined&&(!safeInt(base.maxTokens)||base.maxTokens<1)
      ||base.stop!==undefined&&list(base.stop as unknown as Data,128,'requestLocalSampling.stop').some(value=>typeof value!=='string')) {
      fail('MALFORMED','requestLocalSampling.base')
    }
  }
  const insertions = canonicalInsertions(input.insertions)
  const base = {
    boundarySeq: input.boundarySeq, contentGeneration: input.contentGeneration,
    surfaceNodes: input.surfaceNodes, messages: input.baseRefs,
    sha256: digest(input.baseMessages as unknown as Data),
  }
  const projections=input.messageTextProjections?canonicalMessageTextProjections(input.messageTextProjections):undefined
  const projected=new Map<string,Message|RequestMessageTextProjectionV2>()
  if(projections)for(const projection of projections) {
    const {target}=projection
    const matches=input.baseMessages.filter(message=>String(message.id)===target.id&&message.role===target.role
      &&nativeInputSha256(message)===target.messageSha256)
    if(matches.length!==1||projected.has(target.id))fail('BASE_MISMATCH','projection.target')
    const raw=matches[0]!,message=projectNativeMessageTextV2(raw,projection.textEdits)
    if(message===raw||nativeInputSha256(message)!==projection.projectionSha256)
      fail('MATERIAL_MISMATCH','projection.output')
    projected.set(target.id,message)
  }
  const forbidden = insertions.length > 0 ? forbiddenToolBoundaries(input.baseMessages) : new Set<number>()
  const located = insertions.map((item, insertionOrdinal) => {
    const baseIndex = Math.max(input.protectedPrefixLength, input.baseMessages.length - item.requestedDepth)
    if (forbidden.has(baseIndex)) fail('TOOL_GROUP_SPLIT', `insertions[${insertionOrdinal}]`)
    const row:StructureRow={role:item.requestedRole,content:[{type:'text',text:item.renderedText}],
      provenance:{kind:'insertion',contributionRef:item.contributionRef,sourceSha256:item.sourceSha256},
      seal:(inputSha,content)=>({id:brandString<Message['id']>(`native-material-${inputSha}-${insertionOrdinal}`),
        role:item.requestedRole,content,source:{kind:'request-material',schemaVersion:1,
          encoding:'native-request-material-message-v1',materialInputSha256:inputSha,
          contributionRef:item.contributionRef,sourceSha256:item.sourceSha256,
          renderedSha256:textDigest(content[0]?.type==='text'?content[0].text:'')}} as RequestMaterialMessageV1)}
    return {item,row,insertionOrdinal,placement: {
      contributionRef: item.contributionRef, baseIndex, protectedPrefixLength: input.protectedPrefixLength,
      effectiveDepth: input.baseMessages.length - baseIndex,
    }}
  }).sort((a, b) => a.placement.baseIndex - b.placement.baseIndex || a.item.stableOrder - b.item.stableOrder
    || (a.item.contributionRef < b.item.contributionRef ? -1 : a.item.contributionRef > b.item.contributionRef ? 1 : 0))
  const groups=projectMessageGroups(input,located.map(item=>item.placement.baseIndex))
  const rows:StructureRow[]=[]
  let insertion = 0
  for (let index = 0; index <= input.baseMessages.length; index++) {
    while (located[insertion]?.placement.baseIndex === index) {
      const item = located[insertion++]
      if (!item) fail('MATERIAL_MISMATCH', 'placements')
      rows.push(item.row)
    }
    const item = input.baseMessages[index]
    if (item&&!groups.covered.has(index))rows.push(baseStructureRow(projected.get(String(item.id))??item,input.baseRefs[index]!))
    const replacement=groups.starts.get(index)
    if(replacement)rows.push(replacement)
  }
  return {rows,located,base,insertions,projections}
}

const textDigest=(text:string)=>createHash('sha256').update(text,'utf8').digest('hex')
function structureSurface(rows:readonly StructureRow[]):NativeMaterialTextSurfaceV1 {
  const slots:NativeMaterialTextSurfaceV1['slots'][number][]=[],
    messages:NativeMaterialTextSurfaceV1['messages'][number][]=[]
  for(const [messageOrdinal,row] of rows.entries()) {
    const textSlots:number[]=[]
    messages.push({messageOrdinal,role:row.role,textSlots})
    // Tool results are opaque payloads, even when their serialization is text.
    if(row.role==='tool')continue
    for(const [blockOrdinal,block] of row.content.entries())if(block.type==='text') {
      textSlots.push(slots.length)
      slots.push({messageOrdinal,blockOrdinal,text:block.text,role:row.role,provenance:row.provenance})
    }
  }
  return deepFreeze({messages,slots})
}
/** The producer calls this once on its completed ordered outputs, then shares
 * this same sparse DATA with Core sealing and Native sealing. Unchanged history
 * is already represented by the existing base refs, never persisted again. */
export function projectNativeMaterialTextOutputsV1(surface:NativeMaterialTextSurfaceV1,
  textOutputs:readonly NativeMaterialTextOutputV1[]):NativeMaterialFinalTextProjectionV1|undefined {
  if(textOutputs.length!==surface.slots.length)fail('PROJECTION_MISMATCH','finalTextProjection.slots')
  const changed:NativeMaterialTextOutputV1[]=[]
  for(const [index,slot] of surface.slots.entries()) {
    const output=textOutputs[index]!
    if(output.messageOrdinal!==slot.messageOrdinal||output.blockOrdinal!==slot.blockOrdinal)
      fail('PROJECTION_MISMATCH','finalTextProjection.coordinate')
    if(output.text!==slot.text)changed.push(output)
  }
  return changed.length?deepFreeze({schemaVersion:1,encoding:'native-request-final-text-projection-v1',textOutputs:changed}):undefined
}
function sealStructure(input:NativeRequestMaterialPlanInputV1|NativeRequestMaterialPlanInputV2,
  structure:ReturnType<typeof resolveStructure>):NativeRequestMaterialResultV1 {
  ref(input.snapshot as unknown as Data,'snapshot');ref(input.plan as unknown as Data,'plan')
  const {rows,located,base,insertions,projections}=structure,finalTextProjection=input.finalTextProjection
  const contents=rows.map(row=>row.content)
  if(finalTextProjection) {
    validateNativeMaterialFinalTextProjectionV1(finalTextProjection,'request final text')
    for(const output of finalTextProjection.textOutputs) {
      const row=rows[output.messageOrdinal],block=output.blockOrdinal===null?undefined:row?.content[output.blockOrdinal]
      if(!row||row.role==='tool'||!block||block.type!=='text')fail('PROJECTION_MISMATCH','finalTextProjection.coordinate')
      // Sparse outputs are in transport order. Copy this affected message's
      // block array once, then edit its owned copy across adjacent outputs.
      const content=contents[output.messageOrdinal]===row.content
        ?[...row.content]:contents[output.messageOrdinal] as Array<NativeRequestMessageV1['content'][number]>
      content[output.blockOrdinal!]={...block,text:output.text}
      contents[output.messageOrdinal]=content
    }
  }
  const version=projections?{schemaVersion:2 as const,encoding:'native-request-material-v2' as const}:
    {schemaVersion:1 as const,encoding:'native-request-material-v1' as const}
  const seed={...version,turn:input.turn,step:input.step,header:input.header,snapshot:input.snapshot,plan:input.plan,base,
    delta:{insertions,protectedPrefixLength:input.protectedPrefixLength,...projections?{messageTextProjections:projections}:{},
      ...input.messageProjection?{messageProjection:input.messageProjection}:{},
      ...input.requestLocalSampling?{requestLocalSampling:input.requestLocalSampling}:{},
      ...finalTextProjection?{finalTextProjection}:{}}}
  const inputSha=digest(seed as unknown as Data),messages=rows.map((row,index)=>row.seal(inputSha,contents[index]!))
  const record={...seed,placements:located.map(({placement,insertionOrdinal})=>({...placement,
    messageId:`native-material-${inputSha}-${insertionOrdinal}`})),outputSha256:digest(messages as unknown as Data)}
  return ownedData({record,messages},'result') as unknown as NativeRequestMaterialResultV1
}
function materialize(input:NativeRequestMaterialPlanInputV1|NativeRequestMaterialPlanInputV2):NativeRequestMaterialResultV1 {
  return sealStructure(input,resolveStructure(input))
}
/** The live draft holds only Native-owned structure; final refs never enter
 * text coordinates and no generated message identity exists before sealing. */
export function prepareNativeMaterialTextV1(input:NativeMaterialStructureInputV1) {
  const owned=ownedData(input,'structure') as unknown as NativeMaterialStructureInputV1,
    structure=resolveStructure(owned),surface=structureSurface(structure.rows)
  return Object.freeze({surface,seal:(refs:{readonly snapshot:NativeMaterialDataRefV1;readonly plan:NativeMaterialDataRefV1},
    finalTextProjection?:NativeMaterialFinalTextProjectionV1)=>sealStructure({...owned,...refs,
      ...finalTextProjection?{finalTextProjection}:{}},structure)})
}
function baseStructureRow(message:Message|RequestMessageTextProjectionV2,ref:NativeMaterialMessageRefV1):StructureRow {
  return {role:message.role,content:message.content,provenance:{kind:'base',message:ref},
    seal:(inputSha,content)=>{
      if(content===message.content)return message
      return {...message,id:brandString<Message['id']>(`native-final-text-${inputSha}-${ref.seq}`),content,
        requestProjection:{schemaVersion:1,encoding:'native-request-message-projection-v1',
          materialInputSha256:inputSha,originalMessages:[message]}} as RequestProjectedMessageV1
    }}
}

/** Plain history may change role or collapse into one request-only message.
 * Opaque replay/signatures, tools and media retain their exact original rows. */
function projectMessageGroups(input:NativeMaterialStructureInputV1,insertionPositions:readonly number[]) {
  const starts=new Map<number,StructureRow>(),covered=new Set<number>()
  const projection=input.messageProjection
  if(!projection)return {starts,covered}
  object(projection as unknown as Data,['schemaVersion','encoding','groups',
    ...Object.hasOwn(projection,'textEdits')?['textEdits']:[]],'projection')
  if(projection.schemaVersion!==1||projection.encoding!=='native-request-message-projection-v1')fail('UNKNOWN_VERSION','projection')
  const groups=list(projection.groups as unknown as Data,limits.baseMessages,'projection.groups')
  let bytes=0
  for(const [ordinal,raw] of groups.entries()) {
    const group=object(raw,['targets','role','renderedText'],'projection.group')
    const targets=list(group['targets'],limits.baseMessages,'projection.targets')
    if(!targets.length||!['system','user','assistant'].includes(group['role'] as string)
      ||typeof group['renderedText']!=='string'||!group['renderedText'].isWellFormed())fail('PROJECTION_MISMATCH','projection.group')
    bytes+=Buffer.byteLength(group['renderedText'],'utf8')
    if(bytes>4_194_304)fail('DATA_LIMIT','projection.renderedBytes')
    let start=-1
    for(const [offset,rawTarget] of targets.entries()) {
      const target=object(rawTarget,['id','messageSha256'],'projection.target')
      const index=input.baseRefs.findIndex(ref=>ref.id===target['id']&&ref.messageSha256===target['messageSha256'])
      if(offset===0)start=index
      const message=input.baseMessages[index]
      if(index<0||index!==start+offset||covered.has(index))fail('PROJECTION_MISMATCH','projection.target')
      if(index<input.protectedPrefixLength||!message||!['user','assistant'].includes(message.role)
        ||message.content.some(block=>block.type!=='text'||Object.keys(block).some(key=>!['type','text'].includes(key)))) {
        fail('PROJECTION_BOUNDARY','projection.target')
      }
      covered.add(index)
    }
    if(insertionPositions.some(index=>index>start&&index<start+targets.length))fail('PROJECTION_BOUNDARY','projection.insertion')
    const renderedText=group['renderedText']
    const role=group['role'] as NativeLoreRoleV1,originalMessages=input.baseMessages.slice(start,start+targets.length),
      sourceSha256=digest(targets)
    starts.set(start,{role,content:[{type:'text',text:renderedText}],
      provenance:{kind:'group',targets:input.baseRefs.slice(start,start+targets.length)},
      seal:(inputSha,content)=>({id:brandString<Message['id']>(`native-projection-${inputSha}-${ordinal}`),role,content,
        source:{kind:'request-material',schemaVersion:1,encoding:'native-request-material-message-v1',
          materialInputSha256:inputSha,contributionRef:`projection:${ordinal}`,sourceSha256,
          renderedSha256:textDigest(content[0]?.type==='text'?content[0].text:'')},
        requestProjection:{schemaVersion:1,encoding:'native-request-message-projection-v1',materialInputSha256:inputSha,
          originalMessages}} as NativeRequestMaterialMessageV1)})
  }
  if(projection.textEdits)for(const [ordinal,edit] of projection.textEdits.entries()) {
    object(edit as unknown as Data,['target','blocks'],'projection.textEdit')
    object(edit.target as unknown as Data,['id','messageSha256'],'projection.textEdit.target')
    const index=input.baseRefs.findIndex(ref=>ref.id===edit.target.id&&ref.messageSha256===edit.target.messageSha256)
    const message=input.baseMessages[index]
    if(index<0||covered.has(index)||!message)fail('PROJECTION_MISMATCH','projection.textEdit.target')
    if(index<input.protectedPrefixLength||message.role!=='user'&&message.role!=='assistant')fail('PROJECTION_BOUNDARY','projection.textEdit.target')
    const blocks=new Map<number,string>()
    for(const block of edit.blocks) {
      object(block as unknown as Data,['index','text'],'projection.textEdit.block')
      if(!safeInt(block.index)||blocks.has(block.index)||message.content[block.index]?.type!=='text'
        ||typeof block.text!=='string'||!block.text.isWellFormed())fail('PROJECTION_BOUNDARY','projection.textEdit.block')
      bytes+=Buffer.byteLength(block.text,'utf8')
      if(bytes>4_194_304)fail('DATA_LIMIT','projection.renderedBytes')
      blocks.set(block.index,block.text)
    }
    covered.add(index)
    starts.set(index,{role:message.role,
      content:message.content.map((block,index)=>blocks.has(index)?{type:'text' as const,text:blocks.get(index)!}:block),
      provenance:{kind:'base',message:input.baseRefs[index]!},
      seal:(inputSha,content)=>({...message,id:brandString<Message['id']>(`native-text-projection-${inputSha}-${ordinal}`),content,
        requestProjection:{schemaVersion:1,encoding:'native-request-message-projection-v1',materialInputSha256:inputSha,
          originalMessages:[message]}} as RequestProjectedMessageV1)})
  }
  return {starts,covered}
}

/** Plan against the exact final canonical Native base. Hash consistency is not
 * admission, Source currency, provider dispatch or authority. */
export function planNativeRequestMaterialV1(input: NativeRequestMaterialPlanInputV1|NativeRequestMaterialPlanInputV2): NativeRequestMaterialResultV1 {
  // Messages from Session are deeply frozen; the fresh containing array need not be.
  if (input === null || typeof input !== 'object' || utilTypes.isProxy(input)) fail('DATA_UNSAFE', 'input')
  const descriptor = Object.getOwnPropertyDescriptor(input, 'baseMessages')
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('DATA_UNSAFE', 'input.baseMessages')
  const rawBase = descriptor.value as unknown
  if (!Array.isArray(rawBase) || utilTypes.isProxy(rawBase)) fail('DATA_UNSAFE', 'input.baseMessages')
  const baseLength = Object.getOwnPropertyDescriptor(rawBase, 'length')?.value as unknown
  if (!safeInt(baseLength, limits.baseMessages)) fail('DATA_LIMIT', 'input.baseMessages')
  const baseDescriptors = Object.getOwnPropertyDescriptors(rawBase)
  for (let index = 0; index < baseLength; index++) {
    const item = baseDescriptors[String(index)]
    if (!item || !Object.hasOwn(item, 'value')) fail('DATA_UNSAFE', 'input.baseMessages')
    ownedData(item.value, `input.baseMessages[${index}]`, false, true)
  }
  const data = ownedData(input, 'input')
  const hasProjections=Object.hasOwn(data as object,'messageTextProjections')
  object(data, ['turn', 'step', 'header', 'snapshot', 'plan', 'boundarySeq', 'contentGeneration',
    'surfaceNodes', 'baseMessages', 'baseRefs', 'protectedPrefixLength', 'insertions',
    ...hasProjections?['messageTextProjections']:[],
    ...Object.hasOwn(data as object,'finalTextProjection')?['finalTextProjection']:[],
    ...Object.hasOwn(data as object,'messageProjection')?['messageProjection']:[],
    ...Object.hasOwn(data as object,'requestLocalSampling')?['requestLocalSampling']:[]], 'input')
  const owned = data as unknown as NativeRequestMaterialPlanInputV1|NativeRequestMaterialPlanInputV2
  object(owned.header as unknown as Data, ['seq', 'sha256'], 'header')
  list(owned.surfaceNodes as unknown as Data, limits.baseMessages, 'surfaceNodes')
  list(owned.baseRefs as unknown as Data, limits.baseMessages, 'baseRefs')
  list(owned.baseMessages as unknown as Data, limits.baseMessages, 'baseMessages')
  list(owned.insertions as unknown as Data, limits.insertions, 'insertions')
  return materialize(owned)
}

function recordData(value: unknown): NativeRequestMaterialRecord {
  const data = ownedData(value, 'record')
  if (data === null || typeof data !== 'object' || Array.isArray(data)) fail('MALFORMED', 'record')
  const version=data['schemaVersion']
  if (!(version===1&&data['encoding']==='native-request-material-v1'
    ||version===2&&data['encoding']==='native-request-material-v2'))fail('UNKNOWN_VERSION','record')
  const record = object(data, ['schemaVersion', 'encoding', 'turn', 'step', 'header', 'snapshot', 'plan',
    'base', 'delta', 'placements', 'outputSha256'], 'record')
  object(record['base'] as Data, ['boundarySeq', 'contentGeneration', 'surfaceNodes', 'messages', 'sha256'], 'record.base')
  object(record['delta'] as Data, ['insertions', 'protectedPrefixLength',...version===2?['messageTextProjections']:[],
    ...Object.hasOwn(record['delta'] as object,'finalTextProjection')?['finalTextProjection']:[],
    ...Object.hasOwn(record['delta'] as object,'messageProjection')?['messageProjection']:[],
    ...Object.hasOwn(record['delta'] as object,'requestLocalSampling')?['requestLocalSampling']:[]], 'record.delta')
  object(record['header'] as Data, ['seq', 'sha256'], 'record.header')
  list(record['placements'], limits.insertions, 'record.placements')
  return record as unknown as NativeRequestMaterialRecord
}
export interface NativeRequestMaterialReconstructionInputV1 {
  readonly materialEvent: NativeRequestMaterialEventV1
  /** Full actual log or exact prefix from seq 0; later tail is never folded. */
  readonly events: readonly (SessionEvent | NativeRequestMaterialEventV1)[]
  readonly projections: readonly SessionMessageProjection[]
  /** Actual header digest associated with the inspected request, not latest tail. */
  readonly expectedHeaderSha256: string
}
interface MaterialHistoryRead {
  readonly records: Map<number, NativeRequestMaterialRecord | undefined>
  readonly verified: Set<number>
}
const sessionMaterialHistory=new WeakMap<Session,{
  readonly events:NativeRequestMaterialReconstructionInputV1['events']
  readonly projections:readonly SessionMessageProjection[]
  readonly read:MaterialHistoryRead
}>()
interface NativeSessionMaterialHistory {
  readonly projections: readonly SessionMessageProjection[]
  readonly cursor: ReturnType<typeof createSurfaceCursor>
  readonly verified: Set<number>
  header: SessionEvent<'request/header'> | undefined
  step: SessionEvent<'step/start'> | undefined
  /** Sum of prior material cuts, preserving the standalone replay budget. */
  materialPrefixEvents: number
}
const nativeSessionMaterialHistory=new WeakMap<Session,NativeSessionMaterialHistory>()
/** Historical DATA from the actual Session's immutable log. Only unseen events
 * advance the canonical interpreter; earlier and unordered selections reuse
 * facts at their original cuts and never consume an unrelated later tail. */
export function verifyNativeSessionRequestMaterialHistoryV1(input: {
  readonly session: Session
  readonly endExclusive: number
  readonly projections: readonly SessionMessageProjection[]
  readonly materials: readonly {readonly seq: number; readonly expectedHeaderSha256: string}[]
}): void {
  const {session,endExclusive}=input
  if(!safeInt(endExclusive)||endExclusive>Number(session.seq))fail('BOUNDARY_MISMATCH','history.sessionCut')
  let read=nativeSessionMaterialHistory.get(session)
  if(!read||read.projections.length!==input.projections.length
    ||read.projections.some((projection,index)=>projection!==input.projections[index])) {
    const projections=[...input.projections],definitions=projectionDefinitions(projections)
    read={projections,cursor:createSurfaceCursor({read:()=>({length:Number(session.seq),
      at:seq=>session.eventAt(seq as SessionSeq)}),projections:definitions}),verified:new Set(),
      header:undefined,step:undefined,materialPrefixEvents:0}
    nativeSessionMaterialHistory.set(session,read)
  }
  for(const material of input.materials) {
    if(!safeInt(material.seq,limits.prefixEvents)||material.seq>=endExclusive)
      fail('BOUNDARY_MISMATCH','history.materialSeq')
    const event=session.eventAt(material.seq as SessionSeq)
    if(event?.type!=='request/material')fail('BOUNDARY_MISMATCH','history.materialEvent')
    if(!sha(material.expectedHeaderSha256)||event.data.header.sha256!==material.expectedHeaderSha256)
      fail('HEADER_MISMATCH','expectedHeaderSha256')
    if(!read.verified.has(material.seq))advanceNativeMaterialHistory(session,read,material.seq)
  }
}
function advanceNativeMaterialHistory(session:Session,read:NativeSessionMaterialHistory,through:number):void {
  const accept=(event:SessionEvent)=>{
    if(event.type==='request/header')read.header=event
    else if(event.type==='step/start')read.step=event
  }
  const advance=(end:number)=>{
    try{read.cursor.advanceTo(end,undefined,accept)}
    catch(error){
      if(error instanceof NativeRequestMaterialFailure)throw error
      fail('SURFACE_RECONSTRUCTION_FAILED','canonicalFold')
    }
  }
  for(let seq=read.cursor.length;seq<=through;seq++) {
    const event=session.eventAt(seq as SessionSeq)
    if(!event)fail('BOUNDARY_MISMATCH',`events[${seq}]`)
    if(event.type!=='request/material')continue
    // Complete this record against the strict preceding cut before allowing
    // the cursor past it. A failed record remains the next work on retry.
    advance(seq)
    const record=recordData(event.data)
    validateStoredShape(record)
    if(record.base.boundarySeq!==seq-1)fail('BOUNDARY_MISMATCH','materialEvent.seq')
    if(read.verified.size>limits.insertions)fail('DATA_LIMIT','events.priorMaterials')
    if(seq+read.materialPrefixEvents>limits.reconstructionFoldEvents)
      fail('DATA_LIMIT','events.reconstructionFoldEvents')
    reconstructAgainstSurface(record,{nodes:read.cursor.nodes,contentGeneration:read.cursor.contentGeneration,
      messageAt:node=>{
        const actual=session.eventAt(node as SessionSeq)
        if(!actual)fail('BOUNDARY_MISMATCH','fold.nodes')
        return read.cursor.deriveEventMessage(actual)
      }},read.header,read.step)
    advance(seq+1)
    read.verified.add(seq)
    read.materialPrefixEvents+=seq
  }
}
/** A standalone read owns its complete frozen prefix. An actual Session may
 * retain the same verified historical DATA across append-only captures; a
 * changed projection definition starts a new interpretation of that history. */
export function verifyNativeRequestMaterialHistoryV1(input: {
  readonly events: NativeRequestMaterialReconstructionInputV1['events']
  readonly projections: NativeRequestMaterialReconstructionInputV1['projections']
  readonly materials: readonly Pick<NativeRequestMaterialReconstructionInputV1,
    'materialEvent' | 'expectedHeaderSha256'>[]
  readonly session?:Session
}): void {
  const events = [...input.events], projections = [...input.projections]
  const owner=input.session,previous=owner&&sessionMaterialHistory.get(owner)
  if(owner&&(events.length>Number(owner.seq)||events.some((event,index)=>event!==owner.eventAt(index as SessionSeq))))
    fail('BOUNDARY_MISMATCH','history.session')
  const reusable=previous&&previous.projections.length===projections.length
    &&previous.projections.every((projection,index)=>projection===projections[index])
    &&(previous.events.length<=events.length?previous.events.every((event,index)=>event===events[index]):
      events.every((event,index)=>event===previous.events[index]))
  const read: MaterialHistoryRead = reusable?{records:new Map(previous.read.records),verified:new Set(previous.read.verified)}
    :{records:new Map(),verified:new Set()}
  for (const material of input.materials) {
    // Membership in the actual Session snapshot supplies the trusted index;
    // an arbitrary descriptor must still enter the standalone decoder first.
    const seq=owner?events.indexOf(material.materialEvent):-1,record=read.records.get(seq)
    if(seq>=0&&read.verified.has(seq)
      &&record?.header.sha256===material.expectedHeaderSha256)continue
    reconstructMaterial({materialEvent:material.materialEvent,expectedHeaderSha256:material.expectedHeaderSha256,
      events,projections},read)
  }
  if(owner)sessionMaterialHistory.set(owner,{events:reusable&&previous.events.length>events.length?previous.events:events,
    projections,read})
}
/** Historical reconstruction uses only this record's own exact prefix. It does
 * not query Source/Core or interpret any prior material as a surface overlay. */
export function reconstructNativeRequestMaterialV1(input: NativeRequestMaterialReconstructionInputV1): NativeRequestMaterialResultV1 {
  return reconstructMaterial(input)!
}
function reconstructMaterial(input: NativeRequestMaterialReconstructionInputV1,
  read?: MaterialHistoryRead): NativeRequestMaterialResultV1 | undefined {
  if (input === null || typeof input !== 'object' || utilTypes.isProxy(input)) fail('DATA_UNSAFE', 'reconstruction')
  const desc = Object.getOwnPropertyDescriptors(input)
  const names = ['materialEvent', 'events', 'projections', 'expectedHeaderSha256']
  if (Reflect.ownKeys(desc).length !== names.length || names.some(name => !desc[name]
    || !Object.hasOwn(desc[name], 'value'))) fail('DATA_UNSAFE', 'reconstruction')
  const envelope = ownedData(desc['materialEvent']?.value, 'materialEvent')
  const event = object(envelope, ['type', 'seq', 'time', 'data'], 'materialEvent')
  if (event['type'] !== 'request/material' || !safeInt(event['seq']) || !safeInt(event['time'])) {
    fail('MALFORMED', 'materialEvent')
  }
  const record = recordData(event['data'])
  validateStoredShape(record)
  if (!safeInt(record.base.boundarySeq, limits.prefixEvents - 1)
    || event['seq'] !== record.base.boundarySeq + 1) fail('BOUNDARY_MISMATCH', 'materialEvent.seq')
  const expectedHeader = desc['expectedHeaderSha256']?.value as unknown
  if (!sha(expectedHeader) || expectedHeader !== record.header.sha256) fail('HEADER_MISMATCH', 'expectedHeaderSha256')
  const rawEvents = desc['events']?.value as unknown
  if (!Array.isArray(rawEvents) || utilTypes.isProxy(rawEvents)) fail('DATA_UNSAFE', 'events')
  const eventLength = Object.getOwnPropertyDescriptor(rawEvents, 'length')?.value as unknown
  const prefixLength = record.base.boundarySeq + 1
  if (!safeInt(eventLength) || eventLength < prefixLength) fail('BOUNDARY_MISMATCH', 'events.length')
  if (eventLength > prefixLength) {
    const logged = Object.getOwnPropertyDescriptor(rawEvents, String(event['seq']))
    if (!logged || !Object.hasOwn(logged, 'value')
      || !same(ownedData(logged.value, 'events.material'), envelope)) fail('BOUNDARY_MISMATCH', 'events.material')
  }
  // Only a shallow reference array is allocated. Validate/fold the actual immutable
  // prefix, never structuredClone the history or read arbitrary later tail.
  const prefix: (SessionEvent | NativeRequestMaterialEventV1)[] = []
  for (let seq = 0; seq < prefixLength; seq++) {
    const item = Object.getOwnPropertyDescriptor(rawEvents, String(seq))
    if (!item || !Object.hasOwn(item, 'value')) fail('DATA_UNSAFE', `events[${seq}]`)
    prefix.push(item.value as SessionEvent | NativeRequestMaterialEventV1)
  }
  const priorMaterials: {seq: number; record: NativeRequestMaterialRecord}[] = []
  for (const [seq, item] of prefix.entries()) {
    if (read?.records.has(seq)) {
      const priorRecord = read.records.get(seq)
      if (priorRecord) priorMaterials.push({seq, record: priorRecord})
      if (priorMaterials.length > limits.insertions) fail('DATA_LIMIT', 'events.priorMaterials')
      continue
    }
    ownedData(item, `events[${seq}]`, false, true)
    if (item.seq !== seq) fail('BOUNDARY_MISMATCH', `events[${seq}].seq`)
    if (item.type === 'request/material') {
      const prior = object(item as unknown as Data, ['type', 'seq', 'time', 'data'], `events[${seq}]`)
      const priorRecord = recordData(prior['data'])
      if (priorRecord.base.boundarySeq !== seq - 1) fail('BOUNDARY_MISMATCH', `events[${seq}].data.base`)
      // Required record validated separately but never projected. An unknown or
      // malformed prior material cannot be quietly skipped as ordinary history.
      validateStoredShape(priorRecord)
      priorMaterials.push({seq, record: priorRecord})
      read?.records.set(seq, priorRecord)
      if (priorMaterials.length > limits.insertions) fail('DATA_LIMIT', 'events.priorMaterials')
    } else read?.records.set(seq, undefined)
  }
  const projections = projectionDefinitions(desc['projections']?.value)
  let foldedEvents = prefix.length
  for (const prior of priorMaterials) {
    foldedEvents += prior.seq
    if (foldedEvents > limits.reconstructionFoldEvents) fail('DATA_LIMIT', 'events.reconstructionFoldEvents')
    // Verify each required prior material against its own base, but never apply
    // that overlay to another base. Bounded shallow prefixes share frozen data.
    if (!read?.verified.has(prior.seq)) {
      reconstructAgainstPrefix(prior.record, prefix.slice(0, prior.seq), projections)
      read?.verified.add(prior.seq)
    }
  }
  // Reuse only an already-appended log identity. An unappended candidate at
  // the cut must still be reconstructed, even after another candidate there.
  if (eventLength > prefixLength && read?.verified.has(event['seq'])) return
  const result = reconstructAgainstPrefix(record, prefix, projections)
  if (eventLength > prefixLength&&read) {
    read.records.set(event['seq'],record)
    read.verified.add(event['seq'])
  }
  return result
}
function reconstructAgainstPrefix(record: NativeRequestMaterialRecord,
  prefix: readonly (SessionEvent | NativeRequestMaterialEventV1)[],
  projections: readonly SessionMessageProjection[]): NativeRequestMaterialResultV1 {
  let folded: ReturnType<typeof foldSurface>
  try{folded=foldSurface(prefix as readonly SessionEvent[],projections)}
  catch(error){
    if(error instanceof NativeRequestMaterialFailure)throw error
    fail('SURFACE_RECONSTRUCTION_FAILED','canonicalFold')
  }
  let headerEvent: SessionEvent | NativeRequestMaterialEventV1 | undefined
  let stepEvent: SessionEvent | NativeRequestMaterialEventV1 | undefined
  for(const event of prefix) {
    if(event.type==='request/header')headerEvent=event
    else if(event.type==='step/start')stepEvent=event
  }
  return reconstructAgainstSurface(record,{nodes:folded.nodes,contentGeneration:folded.contentGeneration,
    messageAt:seq=>{
      const actual=prefix[seq]
      if(!actual)fail('BOUNDARY_MISMATCH','fold.nodes')
      return deriveEventMessage(actual as SessionEvent,folded.projectedMessages)
    }},headerEvent,stepEvent)
}
/** Both descriptor replay and the Session cursor use this complete semantic
 * comparison/materialization. A new record still pays for its exact current
 * base messages and output; no previous full event prefix is replayed here. */
function reconstructAgainstSurface(record:NativeRequestMaterialRecord,folded:{
  readonly nodes:readonly number[]
  readonly contentGeneration:number
  messageAt(seq:number):Message|null
},headerEvent:SessionEvent|NativeRequestMaterialEventV1|undefined,
  stepEvent:SessionEvent|NativeRequestMaterialEventV1|undefined):NativeRequestMaterialResultV1 {
  let baseMessages: Message[]
  let baseRefs: NativeMaterialMessageRefV1[]
  try {
    if (!safeInt(folded.contentGeneration)) fail('SURFACE_RECONSTRUCTION_FAILED', 'canonicalFold.contentGeneration')
    baseMessages = []
    baseRefs = []
    for (const seq of folded.nodes) {
      const projected=folded.messageAt(seq)
      if (projected !== null) {
        const message = ownedData(projected, `projection.message[${seq}]`) as unknown as Message
        validateMessage(message as unknown as Data, `projection.message[${seq}]`)
        baseMessages.push(message)
        baseRefs.push({seq, id: message.id, role: message.role, messageSha256: digest(message as unknown as Data)})
      }
    }
  } catch (error) {
    if (error instanceof NativeRequestMaterialFailure) throw error
    fail('SURFACE_RECONSTRUCTION_FAILED', 'canonicalFold')
  }
  const contentGeneration = folded.contentGeneration
  if (contentGeneration !== record.base.contentGeneration || !same(folded.nodes, record.base.surfaceNodes)
    || !same(baseRefs, record.base.messages) || digest(baseMessages as unknown as Data) !== record.base.sha256) {
    fail('BASE_MISMATCH', 'record.base')
  }
  if (!headerEvent || headerEvent.type !== 'request/header' || headerEvent.seq !== record.header.seq
    || digest(headerEvent.data.header as unknown as Data) !== record.header.sha256) fail('HEADER_MISMATCH', 'record.header')
  // Exact turn/step identity is supplied by the historical Native step bracket.
  if (!stepEvent || stepEvent.type !== 'step/start' || stepEvent.data.turn !== record.turn
    || stepEvent.data.step !== record.step) fail('BOUNDARY_MISMATCH', 'record.turnStep')
  const rebuilt = materialize({turn: record.turn, step: record.step, header: record.header,
    snapshot: record.snapshot, plan: record.plan, boundarySeq: record.base.boundarySeq,
    contentGeneration, surfaceNodes: folded.nodes, baseMessages, baseRefs,
    protectedPrefixLength: record.delta.protectedPrefixLength, insertions: record.delta.insertions,
    ...record.schemaVersion===2?{messageTextProjections:record.delta.messageTextProjections}:{},
    ...record.delta.finalTextProjection?{finalTextProjection:record.delta.finalTextProjection}:{},
    ...record.delta.messageProjection?{messageProjection:record.delta.messageProjection}:{},
    ...record.delta.requestLocalSampling?{requestLocalSampling:record.delta.requestLocalSampling}:{}})
  if (!same(rebuilt.record, record)) fail('MATERIAL_MISMATCH', 'record.rebuilt')
  return rebuilt
}
function validateStoredShape(record: NativeRequestMaterialRecord): void {
  if (!safeInt(record.turn) || !safeInt(record.step) || !safeInt(record.base.boundarySeq)
    || !safeInt(record.base.contentGeneration) || !sha(record.base.sha256) || !sha(record.outputSha256)
    || !safeInt(record.header.seq, record.base.boundarySeq) || !sha(record.header.sha256)) fail('MALFORMED', 'priorMaterial')
  ref(record.snapshot as unknown as Data, 'priorMaterial.snapshot')
  ref(record.plan as unknown as Data, 'priorMaterial.plan')
  if(record.schemaVersion===2)canonicalMessageTextProjections(record.delta.messageTextProjections)
  const nodes = list(record.base.surfaceNodes as unknown as Data, limits.baseMessages, 'priorMaterial.nodes')
  const refs = list(record.base.messages as unknown as Data, limits.baseMessages, 'priorMaterial.refs')
  if (!safeInt(record.delta.protectedPrefixLength, refs.length) || new Set(nodes).size !== nodes.length
    || nodes.some(seq => !safeInt(seq, record.base.boundarySeq))) fail('MALFORMED', 'priorMaterial.base')
  let position = 0
  const ids = new Set<string>()
  for (const raw of refs) {
    const item = object(raw, ['seq', 'id', 'role', 'messageSha256'], 'priorMaterial.ref')
    while (position < nodes.length && nodes[position] !== item['seq']) position++
    if (position >= nodes.length || !identity(item['id']) || ids.has(item['id']) || !sha(item['messageSha256'])
      || !['system', 'developer', 'user', 'assistant', 'tool'].includes(item['role'] as string)) fail('MALFORMED', 'priorMaterial.ref')
    ids.add(item['id'])
    position++
  }
  const inserts = list(record.delta.insertions as unknown as Data, limits.insertions, 'priorMaterial.insertions')
  const canonicalItems = canonicalInsertions(inserts as unknown as NativeMaterialInsertionV1[])
  if (!same(canonicalItems, inserts) || record.placements.length !== inserts.length) fail('MALFORMED', 'priorMaterial.placements')
  for (const placement of record.placements) {
    object(placement as unknown as Data, ['contributionRef', 'baseIndex', 'protectedPrefixLength',
      'effectiveDepth', 'messageId'], 'priorMaterial.placement')
    if (!identity(placement.contributionRef) || !identity(placement.messageId)
      || !safeInt(placement.baseIndex, refs.length) || placement.protectedPrefixLength !== record.delta.protectedPrefixLength
      || placement.baseIndex < placement.protectedPrefixLength || placement.effectiveDepth !== refs.length - placement.baseIndex) {
      fail('MALFORMED', 'priorMaterial.placement')
    }
  }
}
/** Definitions are trusted code, not JSON. Reject proxy/getter registries and
 * duplicate types before canonical fold chooses its single interpreter. */
function projectionDefinitions(raw: unknown): readonly SessionMessageProjection[] {
  if (!Array.isArray(raw) || utilTypes.isProxy(raw)) fail('DATA_UNSAFE', 'projections')
  const length = Object.getOwnPropertyDescriptor(raw, 'length')?.value as unknown
  if (!safeInt(length, limits.insertions)) fail('DATA_LIMIT', 'projections')
  const descriptors = Object.getOwnPropertyDescriptors(raw)
  if (!safeInt(length, limits.insertions) || Reflect.ownKeys(descriptors).length !== length + 1) fail('DATA_LIMIT', 'projections')
  const types = new Set<string>()
  const result: SessionMessageProjection[] = []
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)]
    const item: unknown = descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined
    if (!item || typeof item !== 'object' || utilTypes.isProxy(item)) fail('DATA_UNSAFE', `projections[${index}]`)
    const definitions = Object.getOwnPropertyDescriptors(item)
    const type: unknown = definitions['type']?.value
    const project: unknown = definitions['project']?.value
    if (!identity(type) || types.has(type) || typeof project !== 'function' || utilTypes.isProxy(project)
      || type === 'request/material') fail('MALFORMED', `projections[${index}]`)
    types.add(type)
    const callable = project as SessionMessageProjection['project']
    result.push(Object.freeze({type,
      project(event: SessionEvent, context: Parameters<SessionMessageProjection['project']>[1]) {
        return Reflect.apply(callable, item, [event, context])
      },
    }) as SessionMessageProjection)
  }
  return result
}
