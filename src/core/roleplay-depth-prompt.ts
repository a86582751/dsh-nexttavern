import {createHash} from 'node:crypto'
import {recordSha256} from './roleplay-data.js'
import {compileTavernExtensionInventory, compileTavernExtensionInventoryV3,
  compileTavernOpeningCandidates} from './tavern-card.js'
import type {DecodedTavernCard, TavernExtensionInventory, TavernExtensionInventoryV3,
  TavernOpeningContext} from './tavern-card.js'

export const DEPTH_PROMPT_LIMITS = Object.freeze({sourceBytes:65_536, renderedBytes:262_144,
  macros:1024, diagnostics:32, depth:1000, identityChars:256})
// Fixed local ST cache, Generate 4483-4485; readFromV2 keeps extensions intact.
// This consumer policy does not rewrite historical inventory V2 integrity.
export const DEPTH_PROMPT_DEFAULT_POLICY_V1 = Object.freeze({schemaVersion:1 as const,
  sourceCommit:'06bde939fb1e9c4c8d8641d810f0a916b5bce127',sourcePath:'public/script.js',
  sourceSha256:'d1e248efbae8a1df0a248410225cea76901f33533919fc32a28a172c1514600f',
  depth:4,role:'system' as const,semantics:'nullish' as const})
export type DepthPromptRole = 'system' | 'user' | 'assistant'
export type DepthPromptCode = 'SOURCE_INVALID' | 'SOURCE_CHANGED' | 'INVENTORY_CHANGED'
  | 'SHAPE_UNSUPPORTED' | 'FIELD_UNSUPPORTED' | 'ROLE_UNSUPPORTED' | 'DEPTH_UNSUPPORTED'
  | 'PROMPT_BUDGET' | 'MACRO_BUDGET' | 'MACRO_UNSUPPORTED' | 'DYNAMIC_SYNTAX_UNSUPPORTED'
  | 'STATE_SCOPE_UNSUPPORTED' | 'OWNER_UNSUPPORTED' | 'PLACEMENT_INVALID'
  | 'DEPTH_CLAMPED_TO_AVAILABLE_HISTORY' | 'RESOLUTION_CHANGED'
export interface DepthPromptDiagnostic {readonly code:DepthPromptCode; readonly pointer:string}

/** Core obtains these identities from verified import/source capture and the
 * existing preparation frame. This data descriptor does not mint a capability. */
export interface DepthPromptImportSourceV1 {
  readonly schemaVersion:1
  readonly sessionId:string
  readonly worldlineId:string
  readonly frameId:string
  readonly sourceRecordSessionId:string
  readonly importId:string
  readonly rawSha256:string
  readonly transactionId:string
}
export interface DepthPromptSourceRefV1 extends DepthPromptImportSourceV1 {
  readonly sourcePointer:string
  readonly valueSha256:string
  readonly promptPointer:string
  readonly promptSha256:string
  readonly metadataVersion:2
  readonly metadataSha256:string
  readonly declarationsVersion?:3
  readonly declarationsSha256?:string
}
export interface ResolvedDepthPromptV1 {
  readonly schemaVersion:1
  readonly source:DepthPromptSourceRefV1
  readonly sourceText:string
  readonly renderedText:string
  readonly renderedSha256:string
  readonly role:DepthPromptRole
  readonly sourceDefault:'sillytavern-system' | null
  readonly defaultPolicy:typeof DEPTH_PROMPT_DEFAULT_POLICY_V1
  readonly defaultsApplied:readonly ('depth' | 'role')[]
  readonly depth:number
  readonly resolutionSha256:string
  readonly diagnostics:readonly DepthPromptDiagnostic[]
}
export type DepthPromptResolutionV1 =
  | {readonly schemaVersion:1; readonly kind:'resolved'; readonly value:ResolvedDepthPromptV1}
  | {readonly schemaVersion:1; readonly kind:'inactive'; readonly reason:'absent' | 'empty';
    readonly source?:DepthPromptSourceRefV1; readonly diagnostics:readonly DepthPromptDiagnostic[]}
  | {readonly schemaVersion:1; readonly kind:'unsupported'; readonly source?:DepthPromptSourceRefV1;
    readonly diagnostics:readonly DepthPromptDiagnostic[]}
export interface DepthPromptResolveRequestV1 {
  /** Decoded directly from the integrity-checked original; never a client projection. */
  readonly decoded:DecodedTavernCard
  readonly source:DepthPromptImportSourceV1
  /** V2 is authoritative for depth_prompt. V3 describes other extension keys. */
  readonly inventory:TavernExtensionInventory
  readonly declarations?:TavernExtensionInventoryV3
  /** Actual producer identity context, with the same bounds as opening rendering. */
  readonly context?:TavernOpeningContext
}
export interface DepthPromptPlacementRequestV1 {
  readonly value:ResolvedDepthPromptV1
  readonly purpose:'story' | 'classification' | 'maintenance' | 'background'
  readonly source:DepthPromptImportSourceV1
  /** Counts of the assembled model request, before insertion; not Native history. */
  readonly actualMessageCount:number
  /** Root computes this boundary after its system rules and user style instructions.
   * A prompt can never be inserted before this protected prefix. */
  readonly protectedPrefixLength:number
}
export type DepthPromptPlacementV1 =
  | {readonly schemaVersion:1; readonly kind:'placed'; readonly index:number;
    readonly effectiveDepth:number; readonly resolutionSha256:string;
    readonly diagnostics:readonly DepthPromptDiagnostic[]}
  | {readonly schemaVersion:1; readonly kind:'unsupported';
    readonly diagnostics:readonly DepthPromptDiagnostic[]}

const sha = (value:string) => createHash('sha256').update(value,'utf8').digest('hex')
const isHash = (value:unknown):value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const object = (value:unknown):value is Record<string,unknown> => !!value
  && typeof value === 'object' && !Array.isArray(value)
const own = (value:Record<string,unknown>, key:string) => Object.hasOwn(value,key)
const role = (value:unknown):value is DepthPromptRole => value === 'system' || value === 'user' || value === 'assistant'
const identityKeys = ['sessionId','worldlineId','frameId','sourceRecordSessionId','importId','transactionId'] as const
function validSource(value:DepthPromptImportSourceV1):boolean {
  return object(value) && value.schemaVersion === 1 && isHash(value.rawSha256)
    && identityKeys.every(key => typeof value[key] === 'string' && value[key].length > 0
      && value[key].length <= DEPTH_PROMPT_LIMITS.identityChars && !/[\x00-\x1f\x7f]/.test(value[key]))
}
function importIdentity(value:DepthPromptImportSourceV1):DepthPromptImportSourceV1 {
  return {schemaVersion:1, sessionId:value.sessionId, worldlineId:value.worldlineId,
    frameId:value.frameId, sourceRecordSessionId:value.sourceRecordSessionId,
    importId:value.importId, rawSha256:value.rawSha256, transactionId:value.transactionId}
}
function rejected(code:DepthPromptCode, pointer:string, source?:DepthPromptSourceRefV1):DepthPromptResolutionV1 {
  return {schemaVersion:1, kind:'unsupported', ...(source ? {source} : {}), diagnostics:[{code,pointer}]}
}
// Keep this detector local to this consumer: it denies unresolved dynamic/state
// semantics, and neither changes nor expands the MVU Source admission policy.
function syntaxCode(text:string):DepthPromptCode | null {
  if (/<%|<script\b|<iframe\b|javascript:|\b(?:eval|Function|fetch|import|require)\s*\(|\bon[a-z]+\s*=/i.test(text)) {
    return 'DYNAMIC_SYNTAX_UNSUPPORTED'
  }
  if (/\[initvar\]|<\/?(?:initvar|updatevariable|variableupdate|mvu-update)\b/i.test(text)
    || /\b(?:registerMvuSchema|getAllVariables|updateVariables|replaceVariables|insertOrAssignVariables)\s*\(/i.test(text)
    || /\b_\.(?:get|set|merge|assign|unset)\s*\(|\b(?:stat_data|mvu_data)\s*(?:[.\[=]|\()/i.test(text)
    || /\{\{\s*(?:getvar|setvar|addvar|incvar|decvar|run|eval|execute|script)\b/i.test(text)
    || /\$(?:meta|schema|template|required|default)\b|VARIABLE_(?:INIT|UPDATE)|MVU_(?:INIT|UPDATE)/.test(text)) {
    return 'STATE_SCOPE_UNSUPPORTED'
  }
  return null
}
function resolutionPayload(value:Omit<ResolvedDepthPromptV1,'resolutionSha256'>) {
  return {schemaVersion:1,source:value.source,sourceText:value.sourceText,renderedText:value.renderedText,
    renderedSha256:value.renderedSha256,role:value.role,sourceDefault:value.sourceDefault,
    defaultPolicy:value.defaultPolicy,defaultsApplied:value.defaultsApplied,
    depth:value.depth,diagnostics:value.diagnostics}
}

/** Deterministic depth_prompt interpretation only. No model calls, state reads,
 * script execution, writes, Native append, or runtime ownership grants. */
export function resolveRoleplayDepthPrompt(request:DepthPromptResolveRequestV1):DepthPromptResolutionV1 {
  const {decoded,source,inventory,declarations} = request
  if (!validSource(source) || !object(decoded) || decoded.schemaVersion !== 1
    || !object(decoded.document) || !object(decoded.data)
    || !/^(?:json|png)-v[123]$/.test(decoded.format)) return rejected('SOURCE_INVALID','/source')
  if (decoded.sourceSha256 !== source.rawSha256) return rejected('SOURCE_CHANGED','/source/rawSha256')
  // Check the decoded root/data relationship before borrowing the opening renderer.
  const nested = decoded.document.spec === 'chara_card_v2' || decoded.document.spec === 'chara_card_v3'
  if (nested ? decoded.document.data !== decoded.data : decoded.document !== decoded.data) {
    return rejected('SOURCE_INVALID','/source/document')
  }
  const pointer = `${nested ? '/data' : ''}/extensions/depth_prompt`
  let expected:TavernExtensionInventory
  try {
    expected = compileTavernExtensionInventory(decoded)
    if (!object(inventory) || inventory.schemaVersion !== 2
      || recordSha256(inventory) !== recordSha256(expected)
      || (declarations !== undefined && (!object(declarations) || declarations.schemaVersion !== 3
        || recordSha256(declarations) !== recordSha256(compileTavernExtensionInventoryV3(decoded))))) {
      return rejected('INVENTORY_CHANGED',pointer)
    }
  } catch {return rejected('INVENTORY_CHANGED',pointer)}
  const extensions = decoded.data.extensions
  if (extensions === undefined || object(extensions) && !own(extensions,'depth_prompt')) {
    return {schemaVersion:1,kind:'inactive',reason:'absent',diagnostics:[]}
  }
  const value = object(extensions) ? extensions.depth_prompt : undefined
  const entry = expected.entries.find(item => item.key === 'depth_prompt')
  if (!object(value) || !entry || typeof value.prompt !== 'string') return rejected('SHAPE_UNSUPPORTED',pointer)
  const ref:DepthPromptSourceRefV1 = Object.freeze({...importIdentity(source),sourcePointer:pointer,
    valueSha256:entry.valueSha256,promptPointer:`${pointer}/prompt`,promptSha256:sha(value.prompt),
    metadataVersion:2,metadataSha256:recordSha256(expected),
    ...(declarations ? {declarationsVersion:3 as const,declarationsSha256:recordSha256(declarations)} : {})})
  if (Object.keys(value).some(key => !['prompt','depth','role'].includes(key))) {
    return rejected('FIELD_UNSUPPORTED',pointer,ref)
  }
  const detail = entry.detail
  if (detail && (detail.kind !== 'depth-prompt' || detail.promptSha256 !== ref.promptSha256
    || detail.promptChars !== value.prompt.length || detail.depth !== value.depth
    || detail.role !== (value.role ?? null))) {
    return rejected('INVENTORY_CHANGED',pointer,ref)
  }
  const effectiveDepth = value.depth ?? DEPTH_PROMPT_DEFAULT_POLICY_V1.depth
  if (!Number.isSafeInteger(effectiveDepth) || Number(effectiveDepth) < 0
    || Number(effectiveDepth) > DEPTH_PROMPT_LIMITS.depth) {
    return rejected('DEPTH_UNSUPPORTED',`${pointer}/depth`,ref)
  }
  // Fixed ST public/script.js: role_default='system' (551), actual Generate
  // reads depth_prompt.role ?? role_default (4484). Null and absent are equivalent.
  const effectiveRole = value.role ?? DEPTH_PROMPT_DEFAULT_POLICY_V1.role
  if (!role(effectiveRole)) return rejected('ROLE_UNSUPPORTED',`${pointer}/role`,ref)
  if (value.prompt === '') return {schemaVersion:1,kind:'inactive',reason:'empty',source:ref,diagnostics:[]}
  if (Buffer.byteLength(value.prompt,'utf8') > DEPTH_PROMPT_LIMITS.sourceBytes) {
    return rejected('PROMPT_BUDGET',ref.promptPointer,ref)
  }
  const syntax = syntaxCode(value.prompt)
  if (syntax) return rejected(syntax,ref.promptPointer,ref)
  if ((value.prompt.match(/\{\{/g)?.length ?? 0) > DEPTH_PROMPT_LIMITS.macros) {
    return rejected('MACRO_BUDGET',ref.promptPointer,ref)
  }
  // A temporary single-opening view reuses the public renderer verbatim, including
  // bounded identity values and no recursive macro expansion. Keep root identity
  // and raw source SHA; its opening pointer is never used as a depth source ref.
  const data = {...decoded.data,first_mes:value.prompt,alternate_greetings:[]}
  const document = nested ? {...decoded.document,data} : data
  const candidate = compileTavernOpeningCandidates({...decoded,document,data},request.context ?? {})[0]!
  if (candidate.macros.some(macro => macro.status !== 'resolved')) {
    return rejected('MACRO_UNSUPPORTED',ref.promptPointer,ref)
  }
  const renderedText = candidate.renderedText
  const renderedSyntax = syntaxCode(renderedText)
  if (renderedSyntax) return rejected(renderedSyntax,ref.promptPointer,ref)
  // Identity replacement is not rescanned by the opening renderer. A value that
  // leaves template delimiters cannot silently become an executable prompt here.
  if (/\{\{|\}\}/.test(renderedText)) return rejected('MACRO_UNSUPPORTED',ref.promptPointer,ref)
  if (Buffer.byteLength(renderedText,'utf8') > DEPTH_PROMPT_LIMITS.renderedBytes) {
    return rejected('PROMPT_BUDGET',ref.promptPointer,ref)
  }
  const payload = {schemaVersion:1 as const,source:ref,sourceText:value.prompt,renderedText,
    renderedSha256:sha(renderedText),role:effectiveRole,
    sourceDefault:value.role == null ? 'sillytavern-system' as const : null,
    defaultPolicy:DEPTH_PROMPT_DEFAULT_POLICY_V1,
    defaultsApplied:Object.freeze([...(value.depth == null ? ['depth' as const] : []),
      ...(value.role == null ? ['role' as const] : [])]),
    depth:Number(effectiveDepth),diagnostics:[] as readonly DepthPromptDiagnostic[]}
  return {schemaVersion:1,kind:'resolved',value:Object.freeze({...payload,
    resolutionSha256:recordSha256(resolutionPayload(payload))})}
}

/** Index only. Root must use its trusted current preparation owner and the actual
 * assembled request boundary. This never modifies original story messages. */
export function placeRoleplayDepthPrompt(request:DepthPromptPlacementRequestV1):DepthPromptPlacementV1 {
  const {value,source,actualMessageCount,protectedPrefixLength} = request
  const reject = (code:DepthPromptCode):DepthPromptPlacementV1 =>
    ({schemaVersion:1,kind:'unsupported',diagnostics:[{code,pointer:'/placement'}]})
  if (request.purpose !== 'story') return reject('OWNER_UNSUPPORTED')
  if (!validSource(source) || !object(value) || !object(value.source)
    || recordSha256(importIdentity(source)) !== recordSha256(importIdentity(value.source))) {
    return reject('SOURCE_CHANGED')
  }
  if (value.schemaVersion !== 1 || !role(value.role) || !Number.isSafeInteger(value.depth)
    || value.depth < 0 || value.depth > DEPTH_PROMPT_LIMITS.depth
    || typeof value.sourceText !== 'string' || typeof value.renderedText !== 'string'
    || !isHash(value.renderedSha256) || value.renderedSha256 !== sha(value.renderedText)
    || value.source.promptSha256 !== sha(value.sourceText)
    || !isHash(value.resolutionSha256)
    || value.resolutionSha256 !== recordSha256(resolutionPayload(value))) return reject('RESOLUTION_CHANGED')
  if (!Number.isSafeInteger(actualMessageCount) || actualMessageCount < 0
    || !Number.isSafeInteger(protectedPrefixLength) || protectedPrefixLength < 0
    || protectedPrefixLength > actualMessageCount) return reject('PLACEMENT_INVALID')
  const effectiveDepth = Math.min(value.depth,actualMessageCount - protectedPrefixLength)
  return {schemaVersion:1,kind:'placed',index:actualMessageCount - effectiveDepth,effectiveDepth,
    resolutionSha256:value.resolutionSha256,diagnostics:effectiveDepth === value.depth ? []
      : [{code:'DEPTH_CLAMPED_TO_AVAILABLE_HISTORY',pointer:'/placement/depth'}]}
}
