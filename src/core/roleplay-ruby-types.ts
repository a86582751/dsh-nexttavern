/** Ruby DATA contracts. Core supplies admitted inert JSON and actual refs;
 * these modules neither read storage nor mint Source/hash/Native authority. */
export interface RubySourceRefV1 {
  readonly ownerId:string
  readonly sourcePath:string
  readonly version:string
}
export interface RubyIssueV1 {
  readonly code:string
  readonly sourcePath:string
}
export interface RubyReferenceV1 {
  readonly entryKey:string
  readonly varName:string
  readonly label:string
}
export interface RubyMessageItemV1 {
  readonly id:string
  readonly enabled:boolean
  readonly position:'beforeUser'|'afterUser'|'tail'
  readonly role:'system'|'assistant'|'user'
  readonly content:string
}
export interface RubyTaskV1 {
  readonly id:number
  readonly taskKey:string
  readonly sourcePath:string
  readonly enabled:boolean
  readonly displayName:string
  readonly cyclePositions:readonly number[]
  readonly promptKey:string
  readonly outputKey:string
  readonly outputVarName:string
  readonly extraKeys:string
  readonly enableJailbreak:boolean
  readonly outputConstant:boolean
  readonly outputDisable:boolean
  readonly selective:boolean
  readonly selectiveKeys:readonly string[]
  readonly noRecursion:boolean
  readonly position:number
  readonly depth:number
  readonly order:number
  readonly keywordScanEnabled:boolean
  readonly keywordScanKeywords:readonly string[]
  readonly useReferences:readonly string[]
  readonly useOutputs:readonly string[]
  readonly issues:readonly RubyIssueV1[]
}
export interface RubyConfigurationV1 {
  readonly schemaVersion:1
  readonly encoding:'ruby-static-configuration-data-v1'
  readonly source:RubySourceRefV1
  readonly status:'empty'|'supported-static'|'unsupported'
  readonly activePresetId:string
  readonly charName:string
  readonly customContentTags:readonly string[]
  readonly referencePool:readonly RubyReferenceV1[]
  readonly tasks:readonly RubyTaskV1[]
  /** Null marks the unavailable default message asset when a producer is enabled. */
  readonly messageItems:readonly RubyMessageItemV1[]|null
  readonly cycleLength:number
  readonly issues:readonly RubyIssueV1[]
  readonly requestsPerEligibleTask:1
}
export interface RubyTriggerV1 {
  readonly taskKey:string
  readonly cycleRound:number
  readonly position:number
  readonly sourceOrdinal:number
}
export interface RubyCursorV1 {
  readonly schemaVersion:1
  readonly encoding:'ruby-static-scheduling-data-v1'
  readonly baseline:number
  readonly triggers:readonly RubyTriggerV1[]
  readonly bookmarks:Readonly<Record<string,number>>
}
export interface RubyScheduleV1 {
  readonly schemaVersion:1
  readonly encoding:'ruby-static-schedule-data-v1'
  readonly kind:'scheduled'|'empty'|'unsupported'
  readonly cursor:RubyCursorV1
  readonly due:readonly {readonly task:RubyTaskV1;readonly trigger:RubyTriggerV1}[]
  readonly issues:readonly RubyIssueV1[]
}
/** Adapter selects completed canonical prose and real player rows. Opening is
 * an assistant row; tools, management, alternatives and failed prose are absent. */
export interface RubySelectedMessageV1 {
  readonly ref:RubySourceRefV1
  readonly seq:number
  readonly messageId:string
  readonly messageVersion:string
  readonly role:'user'|'assistant'
  readonly speakerName:string
  readonly text:string
}
export interface RubyWorldbookEntryV1 {
  readonly ref:RubySourceRefV1
  readonly keys:readonly string[]
  /** Captured current text; selected lookups receive the owner's ST projection. */
  readonly resolvedContent:string
}
export interface RubyWorldbookV1 {
  /** Namespace ref records a negative lookup as well as a present entry. */
  readonly ref:RubySourceRefV1
  readonly entries:readonly RubyWorldbookEntryV1[]
}
export interface RubyInputWindowV1 {
  readonly schemaVersion:1
  readonly encoding:'ruby-incremental-input-data-v1'
  readonly startOrdinal:number
  readonly endOrdinal:number
  readonly count:number
  readonly messages:readonly RubySelectedMessageV1[]
  readonly scanText:string
}
export interface RubyPreparedInputV1 {
  readonly schemaVersion:1
  readonly encoding:'ruby-analysis-input-data-v1'
  readonly configuration:RubySourceRefV1
  readonly taskKey:string
  readonly trigger:RubyTriggerV1
  readonly window:RubyInputWindowV1
  readonly matchedKeywords:readonly string[]
  readonly promptRef:RubySourceRefV1
  readonly referenceRefs:readonly RubySourceRefV1[]
  readonly outputRefs:readonly RubySourceRefV1[]
  readonly truncatedBodyChars:number
  readonly messages:readonly {readonly role:RubyMessageItemV1['role'];readonly content:string}[]
  readonly mainInputMessageIndex?:number
  readonly normalRequests:1
}
export type RubyInputDecisionV1=
  |{readonly kind:'prepared';readonly input:RubyPreparedInputV1}
  |{readonly kind:'skipped';readonly reason:'no-new-text'|'keyword-miss';readonly taskKey:string;
    readonly window:RubyInputWindowV1;readonly normalRequests:0}
  |{readonly kind:'unsupported';readonly issues:readonly RubyIssueV1[];readonly normalRequests:0}
export type RubyAnalysisWindowDecisionV1=
  |{readonly kind:'eligible';readonly window:RubyInputWindowV1;readonly matchedKeywords:readonly string[]}
  |Extract<RubyInputDecisionV1,{readonly kind:'skipped'|'unsupported'}>
export interface RubyPreparedOutputV1 {
  readonly schemaVersion:1
  readonly encoding:'ruby-analysis-output-data-v1'
  readonly configuration:RubySourceRefV1
  readonly taskKey:string
  readonly outputVarName:string
  readonly sourceOrdinal:number
  readonly content:string
  readonly target:'chat-worldbook'|'owner-output'
  readonly suppressCharacterKey:string|null
  readonly entry:null|{
    readonly lookupKey:string
    /** Null leaves an existing key list unchanged; new entries start with lookupKey. */
    readonly keyUpdate:readonly string[]|null
    readonly constant:boolean
    readonly disabled:boolean
    readonly excludeRecursion?:true
    readonly preventRecursion?:true
    readonly position:number
    readonly depth?:number
    readonly order:number
    readonly selective?:true
    readonly selectiveLogic?:0
    readonly secondaryKeys?:readonly string[]
  }
  /** Proposed only. Core applies this after its durable publication succeeds. */
  readonly bookmark:{readonly taskKey:string;readonly ordinal:number}
}
