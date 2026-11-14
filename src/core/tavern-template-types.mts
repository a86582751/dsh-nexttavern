import type {MvuJsonObject} from './tavern-mvu-initvar.js'

export type TavernTemplateScopeV1='card'|'chat'|'message'|'script'|'global'|'initial'|'cache'|'preset'
/** Scope names only select one explicit frozen binding. They cannot establish
 * actual Source/current ownership, a runtime lease or Native authority. */
export interface TavernTemplateScopeBindingV1 {
  readonly scope:TavernTemplateScopeV1
  readonly ownerId:string
  readonly versionSha256:string
  readonly values:MvuJsonObject
  readonly valuesSha256:string
}
export interface TavernTemplateLoreBindingV1 {
  readonly key:string
  readonly bookId:string
  readonly entryId:string
  readonly sourcePointer:string
  readonly sourceSnapshotSha256:string
  readonly content:string
  readonly contentSha256:string
  readonly activationAllowed:boolean
  /** Fixed primary-book lookup order is the array order. Repeated comments are
   * retained; getwi selects the first actual matching entry. */
  readonly lookup?:{readonly world:string;readonly title:string;readonly uid:number|null}
  /** Catalog staging never grants admission to unsupported transformed text. */
  readonly readDiagnostic?:{readonly code:string;readonly projectionSha256:string}
}
export interface TavernTemplateFrozenSnapshotV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-template-frozen-snapshot-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly branchId:string
  readonly revision:number
  readonly turnId:string
  readonly attemptId:string
  readonly packageSha256:string
  readonly sourceSnapshotSha256:string
  readonly stateSnapshotSha256:string
  readonly defaultVariableScope:TavernTemplateScopeV1
  readonly scopes:readonly TavernTemplateScopeBindingV1[]
  readonly scopesSha256:string
  readonly lore:readonly TavernTemplateLoreBindingV1[]
  readonly loreSha256:string
  readonly clockEpochMs:number
  readonly randomSeed:string
  readonly randomSeedSha256:string
  readonly snapshotSha256:string
}
export interface TavernTemplateReadV1 {
  readonly kind:'variable'|'lore'
  readonly purpose:'read'|'activation-proposal'
  readonly scope:TavernTemplateScopeV1|null
  readonly ownerId:string|null
  readonly key:string|null
  readonly present:boolean
  readonly versionSha256:string
  readonly valueSha256:string|null
  readonly entryId:string|null
  readonly sourcePointer:string|null
}
export interface TavernTemplateActivationProposalV1 {
  readonly schemaVersion:1
  readonly kind:'activate-lore-entry'
  readonly entryId:string
  readonly bookId:string
  readonly sourcePointer:string
  readonly contentSha256:string
  readonly sourceSnapshotSha256:string
  readonly baseSnapshotSha256:string
  readonly branchId:string
  readonly turnId:string
  readonly attemptId:string
}
export interface TavernTemplateDiagnosticV1 {
  readonly schemaVersion:1
  readonly code:string
  readonly sourcePointer:string|null
  readonly limit:{readonly field:string;readonly observed:number|null;readonly maximum:number}|null
}
export interface TavernTemplateInjectionPromptV1 {
  readonly id:string
  readonly position:'in_chat'|'none'
  readonly depth:number
  readonly role:'system'|'user'|'assistant'
  readonly content:string
  readonly should_scan:boolean
  readonly once:boolean
  readonly batchOrdinal:number
  readonly callbackOrdinal:number|null
}
/** Ordinals identify private functions in the one reconstructed realm. They
 * are replay data and never grant logical Source/Native owner authority. */
export type TavernTemplateInjectionEffectV1=
  |{readonly ordinal:number;readonly kind:'named-upsert';readonly key:string;readonly uid:string;
    readonly prompt:string;readonly order:number;readonly sticky:number}
  |{readonly ordinal:number;readonly kind:'batch-created';readonly batchOrdinal:number;readonly once:boolean;
    readonly ids:readonly string[]}
  |{readonly ordinal:number;readonly kind:'register';readonly prompt:TavernTemplateInjectionPromptV1}
  |{readonly ordinal:number;readonly kind:'remove-ids';readonly ids:readonly string[];
    readonly batchOrdinal:number|null}
