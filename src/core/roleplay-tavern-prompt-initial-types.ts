import type {MvuJsonValue} from './tavern-mvu-initvar.js'
import type {TavernLorePlanV1,TavernLoreDiagnosticV1,TavernLoreEntryPlanV1,
  TavernLoreCurrentNativeMemberReferenceV1} from './tavern-lore-plan-types.mjs'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernPromptVariableCatalogV1} from './roleplay-tavern-prompt-variables-types.js'

export interface TavernPromptInitialCatalogCaptureInputV1 {
  readonly source:TavernLoreSourceDataV1
  readonly plan:TavernLorePlanV1
  /** Actual Source/current-overlay/Workspace owner closure, outside data. */
  readonly assertCurrent:()=>void
  readonly signal?:AbortSignal
  /** Absolute monotonic deadline from this attempt's owner; never renewed. */
  readonly deadlineAt?:number
}
export interface TavernPromptInitialMetadataReadV1 {
  readonly field:'comment'|'name'|'id'|'decorators'
  readonly pointer:string
  readonly presence:'present'|'absent'
  readonly value:MvuJsonValue|null
  readonly valueSha256:string|null
}
export interface TavernPromptInitialCatalogEntryReceiptV1 {
  readonly ordinal:number
  readonly entryId:string
  readonly rawEntryPointer:string
  readonly rawEntrySha256:string
  readonly upstreamUid:TavernLoreEntryPlanV1['upstreamUid']
  readonly disposition:TavernLoreEntryPlanV1['disposition']
  readonly entryPlanSha256:string
  readonly title:string
  readonly titlePolicy:'fixed-character-book-comment-or-empty-v1'
  readonly metadata:readonly TavernPromptInitialMetadataReadV1[]
  readonly originalContentSha256:string|null
  readonly currentContentSha256:string
  readonly currentSemanticSha256:string
  readonly currentContentOrigin:'original-character-book'|'current-native-origin'|'current-native-membership'
  readonly currentNativeOriginSha256:string|null
  /** Present only for current journal membership. Introduced entries have no
   * immutable original address; their incarnation is the actual event ref. */
  readonly currentNativeMember?:TavernLoreCurrentNativeMemberReferenceV1
  readonly originalAddress?:string|null
  readonly decoratorPolicy:'fixed-importer-no-preparsed-inline-current-content-v1'
  readonly initialEnabled:boolean
  readonly initialSelected:boolean
  readonly initialBodySha256:string
}
export interface TavernPromptInitialCatalogLegacyReceiptV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-source-prompt-initial-catalog-receipt-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly sourceSha256:string
  readonly rawSourceSha256:string
  readonly originalBookSha256:string
  readonly compilerPlanSha256:string
  readonly currentNativeOverlaySha256:string|null
  readonly catalogSha256:string
  readonly policySha256:string
  readonly completeOriginalEntryCount:number
  readonly completeCurrentEntryCount?:number
  readonly currentNativeMembershipSha256?:string
  readonly selectedInitialEntryIds:readonly string[]
  readonly entries:readonly TavernPromptInitialCatalogEntryReceiptV1[]
  readonly diagnostics:readonly TavernLoreDiagnosticV1[]
  readonly receiptSha256:string
}
export interface TavernPromptInitialCatalogReceiptV2 extends Omit<TavernPromptInitialCatalogLegacyReceiptV1,
  'schemaVersion'|'encoding'|'diagnostics'> {
  readonly schemaVersion:2
  readonly encoding:'owned-source-prompt-initial-catalog-receipt-v2'
  readonly loreDiagnosticsSha256:string
}
export type TavernPromptInitialCatalogReceiptV1=TavernPromptInitialCatalogLegacyReceiptV1|TavernPromptInitialCatalogReceiptV2
/** Consumer catalog/receipt are frozen. The retained actual closure remains
 * the only currentness authority; hashes and refs do not substitute for it. */
export interface TavernPromptInitialCatalogCaptureV1 {
  readonly catalog:TavernPromptVariableCatalogV1
  readonly receipt:TavernPromptInitialCatalogReceiptV1
  readonly policySha256:string
  readonly assertCurrent:()=>void
}
