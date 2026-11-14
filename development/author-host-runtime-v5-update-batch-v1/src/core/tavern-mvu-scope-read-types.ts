/** A sealed read view is execution input, never authority to publish or mutate.
 * Core captures it under the existing Source/Native owner; history consumes
 * those original facts instead of consulting current scopes or another card. */
import type {MvuJsonObject} from './tavern-mvu-initvar.js'

export type MvuVariableScope='chat'|'message'|'character'|'script'|'global'
export type MvuVariableReadOption=
  | {type:'chat'|'character'|'global'}
  | {type:'message';message_id?:number|'latest'}
  | {type:'script';script_id?:string}

export interface MvuScopeSourceIdentityV1 {
  sessionId:string
  sourceRecordSessionId:string
  importId:string
  rawSha256:string
  sourceSnapshotSha256:string
}
export interface MvuScopeOwnerV1 {
  /** Native scopes are isolated by admitted session and Source by default.
   * This identifier must never imply process-global or cross-player sharing. */
  namespace:'session-source'
  sessionId:string
  sourceRecordSessionId:string
  importId:string
  scope:MvuVariableScope
  identity:string
}
export interface MvuScopeStateRefV1 {
  kind:'opening'|'story'|'manual'|'inherited'
  ownerSessionId:string
  recordKey:string
  recordSha256:string
  snapshotSha256:string
  valuesSha256:string
  revision:number
}
export interface MvuScopeInitializationRefV1 {
  ownerSessionId:string
  operationId:string
  preparationSha256:string
  initSourceSha256:string
  sourceSnapshotSha256:string
  freshBasisProofSha256:string
  initialSourceNativeCutSha256:string
  policySha256:string
  configurationSha256:string
  baselineSha256:string
  valuesSha256:string
}
export type MvuScopeVariablesV1=
  | {kind:'available';variables:MvuJsonObject;variablesSha256:string;provenance:
    | {kind:'initialized-empty';owner:MvuScopeOwnerV1;revision:0}
    | {kind:'initialization-baseline';owner:MvuScopeOwnerV1;initialization:MvuScopeInitializationRefV1}
    | {kind:'published-state';owner:MvuScopeOwnerV1;state:MvuScopeStateRefV1}}
  | {kind:'unavailable';code:'SCOPE_SOURCE_UNAVAILABLE'|'MESSAGE_STATE_UNAVAILABLE'}

export interface MvuScopedMessageV1 {
  /** Array position is the compatibility index. Native seq remains authority. */
  position:number
  ownerSessionId:string
  nativeSeq:number
  messageId:string
  messageVersionSha256:string
  selectedVariant:string
  isSystem:boolean
  variables:MvuScopeVariablesV1
}
export interface MvuScopedScriptV1 {
  scriptId:string
  pointer:string
  sourceSha256:string
  variables:MvuScopeVariablesV1
}
export interface MvuScopeReadFrameV1 {
  schemaVersion:1
  encoding:'native-mvu-scope-read-frame-v1'
  source:MvuScopeSourceIdentityV1
  /** Hash of the enclosing proven SourceNativeCutFacts, not a new lease. */
  sourceNativeCutSha256:string
  viewKind:'script'
  scopes:Readonly<Record<'chat'|'character'|'global',MvuScopeVariablesV1>>
  scripts:readonly MvuScopedScriptV1[]
  messages:readonly MvuScopedMessageV1[]
  frameSha256:string
}
export interface MvuPromptScopeReadBasisV1 {
  readonly schemaVersion:1
  readonly encoding:'native-mvu-prompt-scope-read-basis-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly sourceSnapshotSha256:string
  readonly materialSha256:string
  readonly numericalSnapshotSha256:string
  readonly nativeCut:number
  readonly nativePrefixSha256:string
}
export interface MvuPromptScopeReadDataV1 {
  readonly schemaVersion:1
  readonly encoding:'native-mvu-prompt-scope-read-data-v1'
  readonly authority:'consumer-data-only'
  readonly basis:MvuPromptScopeReadBasisV1
  readonly frame:MvuScopeReadFrameV1
  readonly readDataSha256:string
}
/** Main's selected variables are a separate DATA protocol. They are not a
 * complete compatibility frame or an author's full-history read surface. */
export interface MvuSelectedPromptScopeDataV2 {
  readonly schemaVersion:2
  readonly encoding:'native-mvu-selected-prompt-scope-read-data-v2'
  readonly authority:'consumer-data-only'
  readonly basis:MvuPromptScopeReadBasisV1
  readonly source:MvuScopeSourceIdentityV1
  readonly scopes:MvuScopeReadFrameV1['scopes']
  readonly scripts:readonly MvuScopedScriptV1[]
  readonly messages:readonly MvuScopedMessageV1[]
  readonly selectedBaseSha256:string
  readonly readDataSha256:string
}
export interface MvuPromptVariableScopeDataV3 extends Omit<MvuSelectedPromptScopeDataV2,'schemaVersion'|'encoding'|'messages'> {
  readonly schemaVersion:3
  readonly encoding:'native-mvu-prompt-variable-scope-data-v3'
}
export interface MvuScopeReaderV1 {
  getVariables(option?:MvuVariableReadOption):MvuJsonObject|undefined
  getAllVariables():MvuJsonObject
}
/** Internal decoded DATA access. The owning codec resolves immutable slots and
 * message identity; readers need no complete frame or message inventory copy.
 * latestMessage is the last non-system message, unlike a -1 getter request. */
export type MvuScopeReadMessageV2=Omit<MvuScopedMessageV1,'position'>
export interface MvuScopeReadViewV2 {
  readonly source:MvuScopeSourceIdentityV1
  readonly scopes:Readonly<Record<'chat'|'character'|'global',MvuScopeVariablesV1>>
  script(id:string):MvuScopedScriptV1|undefined
  readonly messageCount:number
  /** Nonnegative compatibility position, already normalized by the reader. */
  messageAt(index:number):MvuScopeReadMessageV2|undefined
  readonly latestMessage:MvuScopeReadMessageV2|undefined
}
export const MVU_SCOPE_READ_LIMITS=Object.freeze({
  messages:4096,scripts:256,frameBytes:1_048_576,valueNodes:131072,valueDepth:48,
})
