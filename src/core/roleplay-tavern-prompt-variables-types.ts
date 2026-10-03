import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernTemplateScopeBindingV1,TavernTemplateScopeV1} from './tavern-template-types.mjs'
import type {TavernLoreSemanticEntryV1} from './tavern-lore-plan-types.mjs'

/** These refs describe actual supplier-captured facts. JSON cannot establish
 * their identity/currentness, a Source lease, Native permission or execution. */
export interface TavernPromptVariableRefV1 {
  readonly ownerId:string
  readonly versionSha256:string
  readonly ref:MvuJsonObject
  readonly refSha256:string
}
export type TavernPromptVariableObjectFactV1=
  |{readonly kind:'values';readonly values:MvuJsonObject;readonly valuesSha256:string;
      readonly provenance:TavernPromptVariableRefV1}
  |{readonly kind:'absent';readonly provenance:TavernPromptVariableRefV1}
  |{readonly kind:'unavailable';readonly missingEvidence:readonly string[]}
export interface TavernPromptVariableScopeFactV1 {
  readonly scope:'global'|'chat'|'message'|'script'|'card'|'cache'
  readonly fact:TavernPromptVariableObjectFactV1
}
export interface TavernPromptVariableCatalogEntryV1 {
  readonly ordinal:number
  readonly entryId:string
  readonly rawEntryPointer:string
  readonly rawEntrySha256:string
  readonly title:string
  readonly currentSemantic:TavernLoreSemanticEntryV1
  readonly currentSemanticSha256:string
  readonly contentPointer:string
  readonly content:string
  readonly contentSha256:string
  /** null means no pre-parsed decorators were supplied by the actual owner.
   * A nonempty list follows fixed WorldInfoDecorators' override branch. */
  readonly decorators:readonly string[]|null
  readonly provenance:TavernPromptVariableRefV1
}
export interface TavernPromptVariableCatalogV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-prompt-initial-variable-catalog-v1'
  readonly sourceSha256:string
  readonly bookSha256:string
  readonly entries:readonly TavernPromptVariableCatalogEntryV1[]
  readonly invertEnabled:boolean
  readonly settingsRef:TavernPromptVariableRefV1
  readonly completeCatalogRef:TavernPromptVariableRefV1
  readonly catalogSha256:string
}
export interface TavernPromptMessageVariablesFactV1 {
  readonly index:number
  readonly messageId:string
  readonly activeSwipe:number
  readonly active:TavernPromptVariableObjectFactV1
  /** The selected swipe can differ from activeSwipe. Previous selection always
   * reads active, exactly as findPreviousMessageVariables does. */
  readonly selectedSwipe:number|null
  readonly selected:TavernPromptVariableObjectFactV1|null
  readonly selectedInitialized:boolean|null
  readonly initializedRef:TavernPromptVariableRefV1|null
  readonly messageRef:TavernPromptVariableRefV1
}
export type TavernPromptMessageHistoryV1=
  |{readonly kind:'complete-prefix';readonly messageCount:number;
      readonly selectedIndex:number|null;readonly selectedSwipe:number|null;
      readonly messages:readonly TavernPromptMessageVariablesFactV1[];
      readonly membershipRef:TavernPromptVariableRefV1}
  |{readonly kind:'unavailable';readonly missingEvidence:readonly string[]}
export interface TavernPromptVariableAttemptV1 {
  readonly attemptId:string
  readonly traceCounter:number
  readonly provenance:TavernPromptVariableRefV1
}
export interface TavernPromptVariableInputV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-prompt-variable-input-v1'
  readonly sessionId:string
  readonly source:TavernLoreSourceDataV1|null
  readonly catalog:TavernPromptVariableCatalogV1|null
  readonly scopes:readonly TavernPromptVariableScopeFactV1[]
  readonly history:TavernPromptMessageHistoryV1
  readonly attempt:TavernPromptVariableAttemptV1|null
}
export interface TavernPromptVariableReadV1 {
  readonly kind:'source'|'catalog'|'settings'|'scope'|'message'|'history'|'attempt'|'render'
  readonly identity:string
  readonly valueSha256:string
  readonly provenance:TavernPromptVariableRefV1
}
export type TavernPromptVariableAvailabilityV1=
  |{readonly kind:'bound';readonly binding:TavernTemplateScopeBindingV1;
      readonly reads:readonly TavernPromptVariableReadV1[];readonly derivationSha256:string}
  |{readonly kind:'unavailable';readonly scope:'initial'|'cache';readonly ownerId:string;
      readonly missingEvidence:readonly string[];readonly reads:readonly TavernPromptVariableReadV1[];
      readonly diagnostic:'PROMPT_VARIABLE_SCOPE_UNAVAILABLE'}
export interface TavernPromptInitialRenderRequestV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-prompt-initial-render-request-v1'
  readonly sessionId:string
  readonly attempt:TavernPromptVariableAttemptV1
  readonly sourceSha256:string
  readonly catalogSha256:string
  readonly entry:TavernPromptVariableCatalogEntryV1
  readonly body:string
  readonly bodySha256:string
  readonly initialSoFar:TavernTemplateScopeBindingV1
  /** Optional cache here is only the actual explicitly captured pre-initial
   * cache fact; it is never synthesized from initialSoFar. */
  readonly readonlyScopes:readonly TavernTemplateScopeBindingV1[]
  readonly unavailableScopes:readonly TavernTemplateScopeV1[]
  readonly defaultVariableScope:'cache'
  readonly requestSha256:string
}
export interface TavernPromptInitialRenderOutputV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-prompt-initial-render-output-v1'
  readonly pipeline:'actual-macro-template-regex-ejs-v1'
  readonly requestSha256:string
  readonly renderedText:string
  readonly renderedTextSha256:string
  readonly reads:readonly TavernPromptVariableReadV1[]
  readonly renderRef:TavernPromptVariableRefV1
}
export interface TavernPromptVariableProducerV1 {
  assertCurrent():void
  readonly signal?:AbortSignal
  renderInitial(request:TavernPromptInitialRenderRequestV1,signal?:AbortSignal):
    TavernPromptInitialRenderOutputV1|Promise<TavernPromptInitialRenderOutputV1>
}
export interface TavernPromptInitialMergeV1 {
  readonly entryId:string
  readonly rawEntryPointer:string
  readonly rawEntrySha256:string
  readonly currentSemanticSha256:string
  readonly contentPointer:string
  readonly contentSha256:string
  readonly bodySha256:string
  readonly title:string
  readonly parser:'json-data-v1'|'yaml-1.2-json-data-v1'
  readonly renderedTextSha256:string
  readonly renderedText:string
  readonly parsedData:MvuJsonObject
  readonly dataSha256:string
  readonly mergedValuesSha256:string
  readonly requestSha256:string
  readonly reads:readonly TavernPromptVariableReadV1[]
  readonly renderRef:TavernPromptVariableRefV1
}
export interface TavernPromptVariablePacketV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-prompt-variable-packet-v1'
  readonly authority:'consumer-data-only'
  readonly policy:'readonly-st-initial-catalog-order-cache-shallow-v1'|'readonly-native-manual-cache-overlay-v1'
  readonly sessionId:string
  readonly sourceSha256:string|null
  readonly catalogSha256:string|null
  readonly inputSha256:string
  readonly defaultVariableScope:'cache'
  readonly initial:TavernPromptVariableAvailabilityV1
  readonly cache:TavernPromptVariableAvailabilityV1
  readonly initialMerges:readonly TavernPromptInitialMergeV1[]
  readonly selection:{readonly disposition:'already-initialized'|'readonly-previous-copy'
    |'readonly-initial-fallback'|'readonly-own-first-message'|'empty-chat'|'unavailable';
    readonly messageId:string|null;readonly swipe:number|null;readonly previousMessageId:string|null;
    readonly selectedValuesSha256:string|null}
  readonly reads:readonly TavernPromptVariableReadV1[]
  readonly diagnostics:readonly {readonly code:string;readonly scope:'initial'|'cache';readonly detail:string}[]
  readonly packetSha256:string
}
export type TavernPromptVariableResultV1=
  |{readonly kind:'prepared';readonly input:TavernPromptVariableInputV1;readonly packet:TavernPromptVariablePacketV1}
  |{readonly kind:'refused'|'cancelled';readonly diagnostics:readonly {readonly code:string;readonly detail:string}[]}
