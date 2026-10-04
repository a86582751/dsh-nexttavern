/** New raw data + prompt author Source facts. No fresh basis, readiness,
 * initialized state, Native receipt or publication capability is encoded. */
import type {OpeningSource,OpeningCatalog} from './roleplay-opening-selection.js'
import type {TavernOpeningContext,TavernOpeningCandidate} from './tavern-card.js'
import type {SchemaMvuInitDataSource,SchemaMvuInitDataResult}
  from './tavern-mvu-initvar.js'
import type {NativeMvuSourcePolicy} from './roleplay-mvu-source-policy.js'
import type {PromptProgramSourceDepsV1,PromptProgramSourceInventoryV1}
  from './roleplay-prompt-program-source-types.js'
import type {ReadBranchSession} from './roleplay-worldline-types.js'
import type {TavernSourceInheritanceOwnerV1,TavernSourceInheritanceDescriptorV1,
  TavernSourceInheritanceRefV1,TavernSourceApplyIntentV1}
  from './roleplay-tavern-source-inheritance-types.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernLoreBookAbsenceProofV1} from './tavern-lore-plan-types.mjs'
import type {RoleplayInputStateOwner} from './roleplay-input-state.js'

export interface PromptOpeningSourceDepsV1 extends PromptProgramSourceDepsV1 {
  readonly inputState?:Pick<RoleplayInputStateOwner,'captureSource'>
  readonly session:(sessionId:string)=>ReadBranchSession|undefined
  readonly readOpeningContext:(sessionId:string)=>{readonly context:TavernOpeningContext;readonly bindingSha256:string}
  /** Existing actual closed Source owner, required for a fresh copied child.
   * It checks the original setup prefix even after later Native events append. */
  readonly sourceInheritance?:Pick<TavernSourceInheritanceOwnerV1,'readCommittedStaticSourceInheritance'>
}
export type PromptOpeningSourceCodeV1='OPENING_SOURCE_UNAVAILABLE'|'OPENING_SOURCE_CHANGED'
  |'OPENING_SOURCE_RELATION_UNPROVEN'|'OPENING_SOURCE_SELECTION_INVALID'|'OPENING_SOURCE_IMPORT_UNPROVEN'
  |'OPENING_SOURCE_MACRO_UNSUPPORTED'|'OPENING_SOURCE_STATE_SYNTAX_UNSUPPORTED'
  |'OPENING_SOURCE_INITVAR_OUTSIDE_BINDING'|'OPENING_SOURCE_INITVAR_WRAPPER_UNSUPPORTED'
  |'OPENING_SOURCE_INIT_DATA_UNSUPPORTED'|'OPENING_SOURCE_CURRENT_ORIGIN_UNAVAILABLE'
  |'OPENING_SOURCE_BUDGET'|'OPENING_SOURCE_PROOF_INVALID'
export interface PromptOpeningSourceDiagnosticV1 {
  readonly code:PromptOpeningSourceCodeV1
  readonly pointer:string
  readonly calculatorCode?:string
}
export interface PromptOpeningIdentityMacroReadV1 {
  readonly name:'user'|'char'|'user_gender'
  readonly start:number
  readonly end:number
  readonly tokenSha256:string
  readonly valueSha256:string
}
export interface PromptOpeningIdentityRenderingV1 {
  readonly policy:'only-actual-three-identity-macros-v1'
  readonly rawSha256:string
  readonly renderedSha256:string
  readonly used:boolean
  readonly reads:readonly PromptOpeningIdentityMacroReadV1[]
  readonly readsSha256:string
}
export interface PromptOpeningGreetingBlockV1 {
  readonly start:number
  readonly end:number
  readonly bodyStart:number
  readonly bodyEnd:number
  readonly rawWrapperSha256:string
  readonly bodySha256:string
}
export interface PromptOpeningGreetingFactsV1 {
  readonly index:number
  readonly sourcePointer:string
  readonly sourceSha256:string
  readonly rawText:string
  readonly renderedText:string
  readonly renderedSha256:string
  readonly macros:TavernOpeningCandidate['macros']
  readonly identityRendering:PromptOpeningIdentityRenderingV1
  readonly originalInitBlocks:readonly PromptOpeningGreetingBlockV1[]
  readonly renderedInitBlocks:readonly PromptOpeningGreetingBlockV1[]
}
export interface PromptOpeningRawEntryBindingV1 {
  readonly ordinal:number
  readonly entryId:string
  readonly sourceKey:string
  readonly sourcePointer:string
  readonly rawEntrySha256:string
  readonly original:Readonly<Record<string,unknown>>
  readonly isInitVar:boolean
  readonly enabled:boolean
  readonly renderedContent:string|null
  readonly identityRendering:PromptOpeningIdentityRenderingV1|null
  readonly effectivePromptContentSha256:string
}
export interface PromptOpeningRawInitBindingV1 {
  readonly domain:'immutable-raw-embedded-primary-and-complete-original-greetings'
  readonly bookPresence:'actual-primary-book'|'actual-proven-book-absence'
  readonly bookPointer:'/data/character_book'
  readonly rawBook:Readonly<Record<string,unknown>>|null
  readonly rawBookSha256:string
  readonly rawEntries:readonly PromptOpeningRawEntryBindingV1[]
  readonly entryOrderSha256:string
  readonly bookInitEntryPointers:readonly string[]
  readonly greetingFacts:readonly PromptOpeningGreetingFactsV1[]
  readonly greetingFactsSha256:string
  readonly originalBookAbsence:TavernLoreBookAbsenceProofV1|null
  readonly baselinePolicy:'empty-calculation-input-only-not-numerical-absence'
  readonly otherBindings:'not-authorized-and-not-calculated'
  readonly schemaExecution:'none'
}
export interface PromptOpeningRawInitCalculationV1 {
  readonly data:SchemaMvuInitDataSource
  readonly calculation:Extract<SchemaMvuInitDataResult,{kind:'parsed'}>
  readonly dataSha256:string
  readonly calculationSha256:string
  readonly inputBindingSha256:string
  readonly bindings:PromptOpeningRawInitBindingV1
  readonly grammarPolicy:NativeMvuSourcePolicy
  readonly schemaExecution:'none'
  readonly calculationPolicy:'raw-init-data-v1'
}
export type PromptOpeningInitializationV1=PromptOpeningRawInitCalculationV1&(
  {readonly kind:'raw-init-data';readonly markerCount:number}
  |{readonly kind:'absent';readonly reason:'no-actual-initvar-markers';readonly markerCount:0})
interface NativeRelationFactsV1 {
  readonly sessionId:string
  readonly headerId:string|null
  readonly parentSessionId:null
  readonly inheritedEventCount:0
  readonly origin:string|null
}
export type PromptOpeningSourceRelationV1={readonly kind:'own-root-source';readonly native:NativeRelationFactsV1;
  readonly branchMetaRef:TavernLoreSourceDataV1['current']['rows'][number]['ref'];readonly inheritance:null;readonly setup:null}
  |{readonly kind:'committed-fresh-cut0-source';readonly native:NativeRelationFactsV1;
    readonly branchMetaRef:TavernLoreSourceDataV1['current']['rows'][number]['ref'];
    readonly inheritance:TavernSourceInheritanceDescriptorV1;
    readonly setup:{readonly applyIntentRef:TavernSourceInheritanceRefV1;
      readonly nativeSetup:NonNullable<TavernSourceApplyIntentV1['nativeSetup']>;readonly nativeSetupSha256:string}}
export interface PromptOpeningSourceProofV1 {
  readonly schemaVersion:1
  readonly encoding:'native-prompt-opening-source-proof-v1'
  readonly authority:'consumer-data-only'
  readonly policySha256:string
  readonly source:OpeningSource
  readonly sourceRelation:PromptOpeningSourceRelationV1
  readonly program:PromptProgramSourceInventoryV1
  readonly catalog:OpeningCatalog
  readonly catalogSha256:string
  readonly context:{readonly values:TavernOpeningContext;readonly bindingSha256:string;readonly valuesSha256:string;
    readonly policy:'only-actual-three-identity-macros-v1'}
  readonly selected:{readonly index:number;readonly sourcePointer:string;readonly sourceSha256:string;
    readonly rawText:string;readonly renderedText:string;readonly renderedSha256:string}
  readonly initialization:PromptOpeningInitializationV1
  readonly initializationInputBindingSha256:string
  readonly promptCurrentInputBindingSha256:string
  readonly authorityLimits:{readonly freshBasis:'not-proven';readonly numericalAbsence:'not-proven';
    readonly initialized:'not-claimed';readonly schemaExecution:'none';readonly native:'not-authorized';
    readonly protectedRenderer:'not-authorized';readonly publish:'not-authorized'}
  readonly bindingSha256:string
  readonly proofSha256:string
}
export type PromptOpeningSourceCaptureV1={readonly kind:'captured-opening-source';
  readonly proof:PromptOpeningSourceProofV1;readonly assertCurrent:()=>void;
  /** Live owner/reader identity only; does not prove DATA currency or grant Source/Native authority. */
  readonly assertOwnerFactsCurrent?:()=>void}
  |{readonly kind:'refused';readonly authority:'none';readonly diagnostics:readonly PromptOpeningSourceDiagnosticV1[]}
