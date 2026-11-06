import type {TavernTemplateFrozenSnapshotV1,TavernTemplateReadV1,
  TavernTemplateActivationProposalV1,TavernTemplateInjectionEffectV1} from './tavern-template-types.mjs'
import type {AuthorChatNamespaceRootV3,AuthorMessageTargetV3} from './roleplay-author-chat-state-types.js'
import type {AuthorMessageViewV1} from './roleplay-author-message-capture.js'
import type {AuthorOrdinaryMessageCaptureV1} from './tavern-author-prompt-types.mjs'
import type {MvuJsonValue} from './tavern-mvu-initvar.js'
import type {TavernPromptMacroSnapshotV1,TavernPromptTransformDiagnosticV1} from './tavern-prompt-transform-types.mjs'

export interface TavernEjsVariableReadOptions {
  scope?:string;index?:string;indexPath?:boolean;noCache?:boolean;withMsg?:unknown
  literalOnly?:boolean;presenceOnly?:boolean
}
export interface TavernEjsVariableWriteOptions extends TavernEjsVariableReadOptions {
  results?:'old'|'new'|'fullcache'
  flags?:'nx'|'xx'|'n'|'nxs'|'xxs'
  merge?:boolean
  dryRun?:boolean
  operation?:'delete'
}

/** Captured by the existing Source/resource owner, never resolved from disk by
 * the template host. id is opaque, not a filesystem path or module specifier. */
export interface TavernEjsResource {
  readonly id:string
  readonly sourcePointer:string
  readonly sourceSnapshotSha256:string
  readonly contentSha256:string
  readonly text:string
  /** The Source owner binds a catalog-backed opaque include to this WI fact.
   * Ordinary EJS partials retain their literal-source include contract. */
  readonly loreKey?:string
}
export type TavernEjsNamedPromptQueuesV1=readonly {readonly key:string;readonly entries:readonly {
  readonly uid:string;readonly prompt:string;readonly order:number;readonly sticky:number}[]}[]
export type TavernEjsPresetCatalogV1={readonly kind:'none';readonly fingerprint:string}
  |{readonly kind:'available';readonly id:string;readonly loadedName:string;readonly fingerprint:string;
    /** Current effective content in the imported prompts array's original order. */
    readonly prompts:readonly {readonly name:string;readonly content:string;readonly sourcePointer:string}[]}
export interface TavernEjsHostCapture {
  readonly presetCatalog?:TavernEjsPresetCatalogV1
  readonly ordinaryMessageView?:{
    readonly messages:AuthorMessageViewV1['messages']
    readonly captures:readonly AuthorOrdinaryMessageCaptureV1[]
    readonly current:{readonly message_id:number;readonly swipe_id:number}|null
  }
  /** Missing is unavailable; an explicitly captured empty list is known empty. */
  readonly namedPromptQueues?:TavernEjsNamedPromptQueuesV1
  readonly snapshot:TavernTemplateFrozenSnapshotV1
  readonly resources:readonly TavernEjsResource[]
  /** Native message projection supplied by the existing capture owner. */
  readonly context:Readonly<Record<string,unknown>>
  readonly macros:TavernPromptMacroSnapshotV1
  /** Actual shared State2 import namespace supplied by the Source owner. */
  readonly ordinaryNamespace?:{readonly root:AuthorChatNamespaceRootV3;
    readonly values:Readonly<Record<string,MvuJsonValue>>}
}
/** Dynamic helper basis. Captured messages/lexical context remain with their
 * actual creation closure and are not rewritten by a later phase. */
export type TavernEjsPhaseCapture=Omit<TavernEjsHostCapture,'context'>
export interface TavernEjsHostDiagnostic {
  readonly helper?:string
  readonly code:string
  readonly sourcePointer:string
  readonly line?:number
  readonly macro?:string|null
  readonly limit?:TavernPromptTransformDiagnosticV1['limit']
}
/** Registry DATA selects actual retained guest rules. Neither a RegExp nor a
 * replacement function is reconstructed from this descriptor. */
export interface TavernEjsRegexEffectV1 {
  readonly kind:'upsert'
  readonly ordinal:number
  readonly uid:string
  readonly mode:'basic'|'generate'|'message'
  readonly callbackOrdinal:number
  readonly order:number
  readonly sticky:number
  readonly user:boolean
  readonly assistant:boolean
  readonly system:boolean
  readonly worldinfo:boolean
  readonly reasoning:boolean
  readonly minDepth:number|null
  readonly maxDepth:number|null
  readonly before:boolean
  readonly after:boolean
  readonly html:boolean
}
export interface TavernEjsRegexInputV1 {
  readonly id:string
  readonly text:string
  readonly env?:Readonly<Record<string,MvuJsonValue>>
}
export interface TavernEjsRegexResultV1 {readonly id:string;readonly text:string}
export type TavernEjsHostAction={readonly kind:'filter';readonly callbackOrdinal:number}
  |{readonly kind:'dispose';readonly batchOrdinal:number}
  |{readonly kind:'regex';readonly callbackOrdinal:number;readonly inputs:readonly TavernEjsRegexInputV1[];
    /** The Reader owner narrows new actions after exact accepted Main restore.
     * This is never supplied through author helper settings. */
    readonly consumer?:'reader-regex-phase-v1'}
export interface TavernEjsHostOutput {
  readonly consumerPolicy?:{readonly id:'reader-render-v1'|'reader-regex-phase-v1';readonly sha256:string}
  readonly basis:{readonly sourcePointer:string;readonly contentSha256:string;
    readonly sourceSnapshotSha256:string;readonly snapshotSha256:string}
  readonly renderedText:string
  readonly reads:readonly TavernTemplateReadV1[]
  readonly resourceReads:readonly {readonly id:string;readonly sourcePointer:string;
    readonly sourceSnapshotSha256:string;readonly contentSha256:string}[]
  readonly activations:readonly TavernTemplateActivationProposalV1[]
  readonly injections:readonly TavernTemplateInjectionEffectV1[]
  readonly regexEffects?:readonly TavernEjsRegexEffectV1[]
  readonly regexResults?:readonly TavernEjsRegexResultV1[]
  readonly ordinaryRoot?:AuthorChatNamespaceRootV3
  readonly ordinaryReads:readonly string[]
  readonly ordinaryReadAll:boolean
  readonly ordinaryMessageReads?:readonly {readonly messageTarget:AuthorMessageTargetV3;
    readonly keys:readonly string[];readonly readAll:boolean}[]
  readonly ordinaryWrites:readonly (
    |{readonly ordinal:number;readonly key:string;readonly value:MvuJsonValue;
      readonly operation?:'set';readonly messageTarget?:AuthorMessageTargetV3}
    |{readonly ordinal:number;readonly key:string;readonly operation:'delete';
      readonly messageTarget?:AuthorMessageTargetV3})[]
}
export type TavernEjsHostResult={readonly kind:'rendered';readonly output:TavernEjsHostOutput}
  |{readonly kind:'refused';readonly diagnostic:TavernEjsHostDiagnostic}

/** Live owner; actual callbacks remain in its realm until dispose. These are
 * preparation results, not permission to mutate Source or publish a request. */
export interface TavernEjsHost {
  render(resource:TavernEjsResource):TavernEjsHostResult
  /** Reuses real filter/disposer closures, never reconstructs from values. */
  invoke(action:TavernEjsHostAction,capture?:TavernEjsPhaseCapture):
    {kind:'evaluated';accepted:boolean|null;output:Omit<TavernEjsHostOutput,'renderedText'>}
    |{kind:'refused';diagnostic:TavernEjsHostDiagnostic}
  dispose():void
}
