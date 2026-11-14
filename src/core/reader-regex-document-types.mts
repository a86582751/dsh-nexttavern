/** Current Reader Source DATA, live capture and mutation bridge contracts. */
import type {AuthorNativeDiagnosticV1,AuthorNativeBindingV1,AuthorNativeSnapshotDataV1} from './author-native-helper-types.js'
import type {TavernPromptDisplayPartV1} from './tavern-prompt-transform-types.mjs'
import type {OpeningVariantMutationRequestV1,AuthorOpeningVariantCaptureV1} from './roleplay-opening-variant-types.js'
import type {ReaderWorldbookRenderTargetV1,ReaderWorldbookRenderFragmentV1}
  from './tavern-reader-worldbook-render-types.mjs'
import type {TavernEjsHostOutput,TavernEjsResource,TavernEjsPresetCatalogV1} from './tavern-template-ejs-host-types.mjs'
import type {TavernEjsRuntimeIdentity} from './tavern-template-ejs-runtime-types.mjs'
import type {MvuPlayerEditRequest,MvuPlayerEditResponse} from './roleplay-mvu-player-types.js'
import type {AuthorNativeSourceEventV1} from './author-native-helper-types.js'
import type {MvuScopedMessageV1} from './tavern-mvu-scope-read-types.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {AuthorNativeCommandRequestV1,AuthorNativeCommandResultV1} from './roleplay-author-commands.js'
import type {AuthorMessageBodyRequestV1,AuthorMessageEditResultV1} from './roleplay-author-message-edit-types.js'
import type {ReaderMessageEditOriginV1} from 'dsh-nexttavern-session-format'

export type ReaderMessageVariableTargetV1=Pick<MvuScopedMessageV1,
  'ownerSessionId'|'nativeSeq'|'messageId'|'messageVersionSha256'|'selectedVariant'>
export interface ReaderMessageVariablesV1 {
  readonly target:ReaderMessageVariableTargetV1
  readonly values:MvuJsonObject
}

export interface ReaderRegexDocumentSourceV1 {
  readonly sessionId:string
  readonly sourceRecordSessionId:string
  readonly importId:string
  readonly rawSha256:string
  readonly sourceSnapshotSha256:string
  readonly materialSha256:string
}
export interface ReaderRegexDocumentMessageV1 {
  readonly seq:number
  readonly messageId:string
  readonly messageVersionSha256:string
  readonly depth:number
  readonly isEdit:boolean
}
export interface ReaderRegexDocumentInputV1 {
  readonly schemaVersion:1
  readonly encoding:'reader-regex-document-input-v1'
  readonly source:ReaderRegexDocumentSourceV1
  readonly documents:readonly {
    readonly regex:{readonly ordinal:number;readonly id:string;readonly pointer:string;
      readonly descriptorSha256:string;readonly replacement:string}
    readonly message:ReaderRegexDocumentMessageV1
    readonly replacementSpan:{readonly start:number;readonly end:number}
    /** Actual display replacement callback retained these Source literals and
     * captured text separately; final model HTML is never an input. */
    readonly parts:readonly TavernPromptDisplayPartV1[]
  }[]
}
export interface ReaderRegexDocumentOriginV1 {
  readonly schemaVersion:1
  readonly encoding:'reader-regex-document-origin-v1'
  readonly source:ReaderRegexDocumentSourceV1
  readonly regex:{readonly ordinal:number;readonly id:string;readonly pointer:string;
    readonly descriptorSha256:string;readonly replacementSha256:string;
    readonly htmlSpan:{readonly start:number;readonly end:number}}
  readonly message:ReaderRegexDocumentMessageV1
  readonly replacementSpan:{readonly start:number;readonly end:number}
  /** Exact HTML span from Source replaceString, before captured text slots. */
  readonly htmlSha256:string
  readonly htmlUtf8Bytes:number
  readonly htmlUtf16Length:number
}
/** Derived author output carries its producing EJS/read facts. It cannot be
 * represented as a literal regex replacement or minted from final model HTML. */
export interface ReaderWorldbookDocumentOriginV1 {
  readonly schemaVersion:1
  readonly encoding:'reader-worldbook-document-origin-v1'
  readonly kind:'worldbook-render'
  readonly source:ReaderRegexDocumentSourceV1
  readonly message:ReaderRegexDocumentMessageV1
  readonly target:ReaderWorldbookRenderTargetV1
  readonly phase:'before'|'after'
  readonly entry:ReaderWorldbookRenderFragmentV1['entry']
  readonly executionResourceSha256:string
  readonly disposition:ReaderWorldbookRenderFragmentV1['disposition']
  /** Index into the same program's complete captured producer facts. */
  readonly producerIndex:number
  readonly htmlSha256:string
  readonly htmlUtf8Bytes:number
  readonly htmlUtf16Length:number
}
export interface ReaderWorldbookProducerFactsV1 {
  readonly engine:TavernEjsRuntimeIdentity
  readonly program:Omit<TavernEjsResource,'text'>
  readonly output:Omit<TavernEjsHostOutput,'renderedText'|'activations'|'injections'|'ordinaryWrites'>
}
export interface ReaderWorldbookDocumentInputV1 {
  readonly schemaVersion:1
  readonly encoding:'reader-worldbook-document-input-v1'
  readonly source:ReaderRegexDocumentSourceV1
  readonly producers:readonly ReaderWorldbookProducerFactsV1[]
  readonly documents:readonly {readonly origin:ReaderWorldbookDocumentOriginV1;readonly html:string}[]
}
export type ReaderDocumentInputV1=ReaderRegexDocumentInputV1|ReaderWorldbookDocumentInputV1
export interface ReaderRegexDocumentFailureV1 {
  readonly source:ReaderRegexDocumentSourceV1
  readonly regex:{readonly ordinal:number;readonly id:string;readonly pointer:string;readonly descriptorSha256:string}
  readonly message:ReaderRegexDocumentMessageV1
  readonly replacementSpan:{readonly start:number;readonly end:number}
  readonly diagnostics:readonly AuthorNativeDiagnosticV1[]
}
export interface ReaderWorldbookDocumentFailureV1 {
  readonly origin:ReaderWorldbookDocumentOriginV1
  readonly diagnostics:readonly AuthorNativeDiagnosticV1[]
}
export interface ReaderRegexDocumentSnapshotV1 extends AuthorNativeSnapshotDataV1 {
  readonly schemaVersion:1
  readonly encoding:'reader-regex-document-snapshot-v1'
  readonly readerVariables?:readonly ReaderMessageVariablesV1[]
}
export interface ReaderRegexDocumentReadFactsV1 {
  /** Only the EJS executor consumes this Source catalog, not the browser DTO. */
  readonly presetCatalog?:TavernEjsPresetCatalogV1
  readonly kind:'reader-regex-document-facts'
  readonly data:Omit<ReaderRegexDocumentSnapshotV1,'generation'|'readRevision'>
  readMessagePrefix?(target:Pick<ReaderRegexDocumentMessageV1,'seq'|'messageId'|'messageVersionSha256'>):ReaderMessageVariablesV1
  current():boolean
  /** Actual Session/Agent/Source identity, independent from a DATA revision. */
  sourceCurrent?():boolean
}
export interface ReaderRegexDocumentBindingV1 extends AuthorNativeBindingV1 {
  readonly principal:'reader-regex-document'
}
export type ReaderOpeningVariantResultV1={readonly kind:'committed';readonly operationId:string;
  readonly replayed:boolean;readonly changed:boolean;readonly navigation?:{readonly sessionId:string}}
  |{readonly kind:'refused'|'unknown';readonly operationId:string;readonly code:string}
/** Passed privately from the Reader owner to the canonical mutation owner. */
export interface ReaderOpeningVariantCaptureV1 extends AuthorOpeningVariantCaptureV1 {
  readonly binding:ReaderRegexDocumentBindingV1
  readonly program:{readonly source:ReaderRegexDocumentSourceV1;readonly programSha256:string}
  readonly document:{readonly origin:ReaderRegexDocumentOriginV1|ReaderWorldbookDocumentOriginV1}
  readonly snapshot:ReaderRegexDocumentSnapshotV1
  current():boolean
  sourceCurrent():boolean
}
export interface ReaderOpeningVariantReplyV1 {
  readonly result:ReaderOpeningVariantResultV1
  readonly snapshot?:ReaderRegexDocumentSnapshotV1
}
export interface ReaderNumericalReplyV1 {
  readonly result:MvuPlayerEditResponse
  readonly snapshot?:ReaderRegexDocumentSnapshotV1
  readonly sourceEvents?:readonly AuthorNativeSourceEventV1[]
}
export interface ReaderCommandReplyV1 {
  readonly result:AuthorNativeCommandResultV1
  readonly snapshot?:ReaderRegexDocumentSnapshotV1
}
export interface ReaderMessageBodyReplyV1 {readonly result:AuthorMessageEditResultV1}
export interface ReaderOrdinaryNamespaceRequestV1 {
  readonly operationId:string
  readonly readRevision:number
  readonly nextVariables:Readonly<import('./tavern-mvu-initvar.js').MvuJsonObject>
  readonly selector?:{readonly type:'message';readonly message_id?:number|'latest'}
}
export interface ReaderOrdinaryNamespaceReplyV1 {
  readonly reply:import('./roleplay-author-chat-state-types.js').OrdinaryAuthorChatBatchCommitV3
  readonly snapshot?:ReaderRegexDocumentSnapshotV1
}
export type ReaderRegexDocumentRequestV1=
  |{readonly action:'mutate-reader-namespace';readonly binding:ReaderRegexDocumentBindingV1;
    readonly documentPlanSha256:string;readonly request:ReaderOrdinaryNamespaceRequestV1}
  |{readonly action:'confirm-reader-namespace';readonly sessionId:string;
    readonly operation:import('./roleplay-author-chat-state-types.js').OrdinaryAuthorChatBatchUpdateV3}
  |{readonly action:'retry-reader-namespace';readonly binding:ReaderRegexDocumentBindingV1;
    readonly documentPlanSha256:string;
    readonly operation:import('./roleplay-author-chat-state-types.js').OrdinaryAuthorChatBatchUpdateV3}
  |{readonly action:'mutate-reader-message-body';readonly binding:ReaderRegexDocumentBindingV1;
    readonly documentPlanSha256:string;readonly request:AuthorMessageBodyRequestV1}
  |{readonly action:'confirm-reader-message-body';readonly sessionId:string;readonly operationId:string}
  |{readonly action:'retry-reader-message-body';readonly binding:ReaderRegexDocumentBindingV1;
    readonly documentPlanSha256:string;readonly request:AuthorMessageBodyRequestV1;readonly origin:ReaderMessageEditOriginV1}
  |{readonly action:'execute-reader-commands';readonly binding:ReaderRegexDocumentBindingV1;
    readonly documentPlanSha256:string;readonly request:AuthorNativeCommandRequestV1}
  |{readonly action:'mutate-opening-variants';readonly binding:ReaderRegexDocumentBindingV1;
    readonly documentPlanSha256:string;readonly request:OpeningVariantMutationRequestV1}
  |{readonly action:'release-reader-binding';readonly binding:ReaderRegexDocumentBindingV1}
  |{readonly action:'confirm-opening-variants';readonly sessionId:string;readonly operationId:string}
  |{readonly action:'retry-opening-variants';readonly sessionId:string;readonly operationId:string}
  |{readonly action:'save-reader-numerical';readonly binding:ReaderRegexDocumentBindingV1;
    readonly documentPlanSha256:string;readonly readRevision:number;readonly operation:MvuPlayerEditRequest}
  |{readonly action:'confirm-reader-numerical';readonly operation:MvuPlayerEditRequest}
  |{readonly action:'retry-reader-numerical';readonly operation:MvuPlayerEditRequest}
export type ReaderRegexDocumentReplyV1=
  |({readonly ok:true;readonly kind:'reader-namespace-mutated'}&ReaderOrdinaryNamespaceReplyV1)
  |{readonly ok:true;readonly kind:'reader-namespace-confirmed';
    readonly receipt:import('./roleplay-author-chat-state-types.js').OrdinaryAuthorChatBatchReceiptV3}
  |({readonly ok:true;readonly kind:'reader-message-body-mutated'}&ReaderMessageBodyReplyV1)
  |({readonly ok:true;readonly kind:'reader-message-body-confirmed'}&ReaderMessageBodyReplyV1)
  |({readonly ok:true;readonly kind:'reader-commands-executed'}&ReaderCommandReplyV1)
  |({readonly ok:true;readonly kind:'opening-variants-mutated'}&ReaderOpeningVariantReplyV1)
  |{readonly ok:true;readonly kind:'reader-binding-released'}
  |{readonly ok:true;readonly kind:'opening-variants-confirmed';readonly result:ReaderOpeningVariantResultV1}
  |({readonly ok:true;readonly kind:'reader-numerical-saved'}&ReaderNumericalReplyV1)
  |{readonly ok:false;readonly code:string}
export interface ReaderRegexDocumentHostV1 {
  mutateNamespace?(binding:ReaderRegexDocumentBindingV1,documentPlanSha256:string,
    request:ReaderOrdinaryNamespaceRequestV1,signal:AbortSignal):Promise<ReaderOrdinaryNamespaceReplyV1>
  mutateMessageBody?(binding:ReaderRegexDocumentBindingV1,documentPlanSha256:string,
    request:AuthorMessageBodyRequestV1,signal:AbortSignal):Promise<ReaderMessageBodyReplyV1>
  executeCommands?(binding:ReaderRegexDocumentBindingV1,documentPlanSha256:string,
    request:AuthorNativeCommandRequestV1,signal:AbortSignal):Promise<ReaderCommandReplyV1>
  mutateOpeningVariants(binding:ReaderRegexDocumentBindingV1,documentPlanSha256:string,
    request:OpeningVariantMutationRequestV1,signal:AbortSignal):Promise<ReaderOpeningVariantReplyV1>
  replaceNumerical?(binding:ReaderRegexDocumentBindingV1,documentPlanSha256:string,
    readRevision:number,operation:MvuPlayerEditRequest,signal:AbortSignal):Promise<ReaderNumericalReplyV1>
  closeBinding(binding:ReaderRegexDocumentBindingV1):Promise<void>
}
export type ReaderRegexDocumentRenderFragmentV1={readonly kind:'text';readonly html:string}
  |{readonly kind:'static-document';readonly html:string}
  |{readonly kind:'reader-document';readonly documentPlanSha256:string}
  |{readonly kind:'failed-document';readonly code:string;readonly html:string}
  |{readonly kind:'pending-document';readonly code:string;readonly html:string}
export interface ReaderRegexDocumentRenderV1 {
  readonly renderRevision:number
  readonly css:string
  readonly parts:readonly ({readonly key:string;readonly kind:'user';readonly text:string}
    |{readonly key:string;readonly kind:'narrator';readonly html:string;
      readonly fragments?:readonly ReaderRegexDocumentRenderFragmentV1[]})[]
}
