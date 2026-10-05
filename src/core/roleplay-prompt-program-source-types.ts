/** Versioned inert source inventory. None of these facts is an opening,
 * numerical initialization, Native input permission or protected VM token. */
import type {ImportAssignment,ImportRecord,SourceDescriptor} from './roleplay-import-types.js'
import type {TavernLoreSourceDataV1,TavernLoreSourceRowDataV1}
  from './roleplay-tavern-lore-source-types.js'
import type {PromptTemplateOnlyFieldV1,PromptTemplateOnlySegmentV1}
  from './roleplay-prompt-template-only-types.js'
import type {TavernLoreEntryPlanV1,TavernLoreCurrentNativeOriginV1}
  from './tavern-lore-plan-types.mjs'
import type {captureRoleplayTavernPromptSourceV1} from './roleplay-tavern-prompt-source.js'
import type {TavernLoreEditsDataV1} from './roleplay-tavern-lore-edits-types.js'
import type {createRoleplayTavernLoreEditsV1} from './roleplay-tavern-lore-edits.js'

export type PromptProgramSourceCodeV1='PROGRAM_SOURCE_UNAVAILABLE'|'PROGRAM_IMPORT_UNPROVEN'
  |'PROGRAM_SOURCE_CHANGED'|'PROGRAM_CURRENT_ORIGIN_UNAVAILABLE'|'PROGRAM_COMPILATION_UNPROVEN'
  |'PROGRAM_SOURCE_BUDGET'|'PROGRAM_INVENTORY_INVALID'
export interface PromptProgramSourceDiagnosticV1 {
  readonly code:PromptProgramSourceCodeV1
  readonly pointer:string
}
/** Only the installed Core can supply these readers. capture accepts no
 * arbitrary text, compilation, Source packet, interpreter or permission flag. */
type PromptProgramCoreCaptureDepsV1=Parameters<typeof captureRoleplayTavernPromptSourceV1>[0]
export interface PromptProgramSourceDepsV1 extends PromptProgramCoreCaptureDepsV1 {
  readonly edits:PromptProgramCoreCaptureDepsV1['edits']&{
    readonly observeSourceData?:ReturnType<typeof createRoleplayTavernLoreEditsV1>['observeSourceData']
  }
  readImportRecord(sourceRecordSessionId:string,importId:string):unknown
}
export interface PromptProgramTextV1 {
  readonly text:string
  readonly textSha256:string
  readonly utf16Length:number
  readonly authority:'none'
  readonly execution:'not-authorized'
  readonly tokenization:'complete-UTF16-partition'|'unsupported-delimiters-or-source-budget'
  readonly segments:readonly PromptTemplateOnlySegmentV1[]|null
  readonly segmentsSha256:string|null
  readonly tokenizerDiagnostic:{readonly code:string;readonly pointer:string}|null
}
export interface PromptProgramAssignmentOriginV1 {
  readonly assignmentIndex:number
  readonly assignment:Readonly<ImportAssignment>
  readonly assignmentSha256:string
  readonly sourceDescriptor:Readonly<SourceDescriptor>
  readonly sourceDescriptorSha256:string
  readonly normalizedSectionSha256:string
  readonly normalizedSectionLength:number
}
export type NextTavernPromptAuthorFieldV1=`cards/${number}/content`|`worldbook/${number}/content`
  |`rules/${'core'|'plot'|'narrative'|'reply'|'style'}`|'status/text'
  |`compatibility/sillytavernMacroFields/${PromptTemplateOnlyFieldV1}`
export type PromptProgramAuthorFieldNameV1=PromptTemplateOnlyFieldV1|NextTavernPromptAuthorFieldV1
export interface PromptProgramAuthorFieldMappingV1 {
  readonly field:PromptProgramAuthorFieldNameV1
  readonly originalPointer:string
  readonly presence:'absent'|'text'
  readonly rawText:string|null
  readonly normalizedText:string|null
  readonly assignment:PromptProgramAssignmentOriginV1|null
  readonly currentGroupId:string|null
  readonly originalGroupSpan:{readonly start:number;readonly end:number}|null
}
export interface PromptProgramProjectionPartV1 {
  readonly kind:'author-field'|'worldbook-content'
  readonly originalPointer:string
  readonly authorField:PromptProgramAuthorFieldNameV1|null
  readonly rawEntryPointer:string|null
  readonly start:number
  readonly end:number
  readonly assignment:PromptProgramAssignmentOriginV1
}
export interface PromptProgramAuthorGroupMappingV1 {
  readonly groupId:string
  readonly row:TavernLoreSourceRowDataV1['ref']
  readonly fieldPointer:string
  readonly originalProjection:string
  readonly effectiveText:string
  readonly parts:readonly PromptProgramProjectionPartV1[]
  readonly currentOrigin:{readonly kind:'exact-original-projection'|'exact-portable-author-data'|'actual-current-row-edit';
    readonly row:TavernLoreSourceRowDataV1['ref'];readonly sourceDescriptorsSha256:string;
    readonly editedFrom:Readonly<Record<string,unknown>>|null;readonly editedFromSha256:string|null}
  /** An edited shared field is one actual current group. No substring-derived
   * field split or per-field current offset is claimed. */
  readonly currentFieldOffsets:'same-as-original'|'unavailable-shared-group-edit'
}
export interface PromptProgramAuthorMappingV1 {
  readonly fields:readonly PromptProgramAuthorFieldMappingV1[]
  readonly groups:readonly PromptProgramAuthorGroupMappingV1[]
  readonly assignmentInventory:readonly PromptProgramAssignmentOriginV1[]
  readonly bookAssignments:readonly {readonly rawEntryPointer:string;readonly assignment:PromptProgramAssignmentOriginV1}[]
}
export interface PromptProgramAuthorFieldV1 extends Omit<PromptProgramAuthorFieldMappingV1,'rawText'|'normalizedText'> {
  readonly raw:PromptProgramTextV1|null
  readonly normalized:PromptProgramTextV1|null
}
export interface PromptProgramAuthorGroupV1 extends Omit<PromptProgramAuthorGroupMappingV1,'originalProjection'|'effectiveText'> {
  readonly original:PromptProgramTextV1
  readonly effective:PromptProgramTextV1
}
export interface PromptProgramBookEntryV1 {
  readonly entryId:string
  readonly ordinal:number
  readonly sourceKey:string
  readonly originalAddress:string
  readonly rawEntrySha256:string
  readonly contentPointer:string
  readonly disposition:TavernLoreEntryPlanV1['disposition']
  readonly promptEligibility:'requires-actual-selection-and-protected-runtime'|'disabled-never-execute'|'ineligible-never-execute'
  readonly numericalInitialization:'not-authorized'
  readonly original:PromptProgramTextV1
  readonly effective:PromptProgramTextV1
  readonly origin:'original-character-book'|'current-native-origin'
  readonly currentNativeOrigin:TavernLoreCurrentNativeOriginV1|null
  readonly currentProjection:{readonly row:TavernLoreSourceRowDataV1['ref'];readonly fieldPointer:'/content';
    readonly original:PromptProgramTextV1;readonly effective:PromptProgramTextV1;
    readonly assignment:PromptProgramAssignmentOriginV1;readonly provenance:'actual-compiler-linked-current-row'}|null
  readonly entryPlanSha256:string
  readonly fieldSources:TavernLoreEntryPlanV1['fieldSources']
  readonly fieldSourcesSha256:string
  readonly originalProjectionAssignments:readonly PromptProgramAssignmentOriginV1[]
}
export interface PromptProgramExcludedLeafV1 {
  readonly domain:'original-document'|'current-row'|'current-overlay'
  readonly row:TavernLoreSourceRowDataV1['ref']|null
  readonly pointer:string
  readonly kind:'property-key'|'string'|'non-string'
  readonly valueSha256:string
  readonly utf16Length:number|null
  readonly ejsDelimiterPresent:boolean
  readonly disposition:'not-authorized-by-program-source-inventory'
}
export interface PromptProgramImportTupleV1 {
  readonly ownerSessionId:string
  readonly sourceRecordSessionId:string
  readonly importId:string
  readonly rawSha256:string
  readonly normalizedSha256:string
  readonly documentSha256:string
  readonly dataSha256:string
  readonly normalizer:TavernLoreSourceDataV1['normalizer']
  readonly format:TavernLoreSourceDataV1['original']['decodedFormat']
  readonly coverageSha256:string
  readonly transactionId:string
  readonly activatedAt:number|null
  readonly activationSha256:string
  readonly activePointer:TavernLoreSourceDataV1['original']['activePointer']
  readonly activePointerRef:TavernLoreSourceDataV1['original']['activePointerRef']
  readonly importRecordRef:TavernLoreSourceDataV1['original']['importRecordRef']
  readonly originalActivation:NonNullable<ImportRecord['activation']>
  readonly sourceInheritance:TavernLoreSourceDataV1['inheritance']|null
}
export interface PromptProgramSourceInventoryV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-prompt-program-source-inventory-v1'
    |'native-nexttavern-author-prompt-program-source-inventory-v1'
  readonly authority:'consumer-data-only'
  readonly policySha256:string
  readonly sessionId:string
  readonly includeCardStyle:boolean
  readonly importTuple:PromptProgramImportTupleV1
  readonly sourceCurrentIdentitySha256:string
  readonly authorFields:readonly PromptProgramAuthorFieldV1[]
  readonly authorGroups:readonly PromptProgramAuthorGroupV1[]
  readonly assignments:readonly PromptProgramAssignmentOriginV1[]
  readonly bookEntries:readonly PromptProgramBookEntryV1[]
  readonly book:{readonly pointer:string;readonly rawBookSha256:string;readonly bookDisposition:string;
    readonly compilationSha256:string;readonly planSha256:string;readonly semanticPlanBindingSha256:string;
    readonly currentNativeOverlaySha256:string|null}
  readonly currentRows:readonly TavernLoreSourceRowDataV1['ref'][]
  readonly editing:{readonly dataSha256:string;readonly revision:number;readonly headRef:TavernLoreEditsDataV1['headRef'];
    readonly journalRefs:TavernLoreEditsDataV1['journalRefs'];readonly effectiveOverlaySha256:string}
  readonly unauthorized:readonly PromptProgramExcludedLeafV1[]
  readonly unauthorizedSha256:string
  readonly authorityLimits:{readonly numericalInitialization:'not-authorized';readonly schemaScripts:'not-authorized';
    readonly nativeInput:'not-authorized';readonly protectedExecution:'not-authorized';
    readonly tokenizer:'delimiter-partition-only-not-AST-effect-or-success-proof'}
  /** The semantic binding uses the Source owner's named current projection.
   * Its only excluded fields are the three registered Native meta counters. */
  readonly bindingSha256:string
  readonly audit:{readonly wholeSourceSha256:string;readonly currentRowsSha256:string}
  readonly inventorySha256:string
}
export type PromptProgramSourceCaptureV1={readonly kind:'captured-program-source';
  readonly data:PromptProgramSourceInventoryV1;readonly assertCurrent:()=>void;
  /** Live owner/reader identity only; does not prove DATA currency or grant Source/Native authority. */
  readonly assertOwnerFactsCurrent?:()=>void}
  |{readonly kind:'refused';readonly authority:'none';readonly diagnostics:readonly PromptProgramSourceDiagnosticV1[]}
