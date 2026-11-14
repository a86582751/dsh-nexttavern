/** Browser HTTP payloads locate a private Core attachment. None is a Native
 * execution lease or a replacement for the numerical writer's own reservation. */
import type {AuthorNativeBindingV1,AuthorNativeSourceEventV1} from './author-native-helper-types.js'
import type {AuthorNativeProgramV1} from './author-native-program.mjs'
import type {AuthorNativeHelperSnapshotV1} from './author-native-helper-types.js'
import type {MvuPlayerEditRequest,MvuPlayerEditResponse} from './roleplay-mvu-player-types.js'
import type {AuthorDialogTaskRefV1} from './roleplay-author-dialog.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {AuthorWorldbookMutationV1} from './roleplay-author-worldbook-data.js'
import type {WorldbookEntryWireV1} from './tavern-named-worldbook-data.js'
import type {TavernLoreMutationResultV2} from './roleplay-tavern-lore-edits-types.js'
import type {NativePersonaMutationV1,NativePersonaMutationResultV1} from './roleplay-native-persona-types.js'
import type {BrowserCallbackRegistration,BrowserAuthorInvocation,BrowserGenerationResult,BrowserPromptCleanupRequestV3,
  BrowserMvuHookCompletion}
  from './roleplay-author-browser-generation-types.js'
import type {MvuJsonValue} from './tavern-mvu-initvar.js'
import type {TavernLoreMutationRetryLocatorV1} from './roleplay-tavern-lore-edits-types.js'
import type {AuthorScriptResourceRequestV1} from './roleplay-author-script-resources.js'
import type {OpeningVariantMutationRequestV1} from './roleplay-opening-variant-types.js'
import type {OpeningVariantMutationResult} from './roleplay-opening-variants.js'
import type {AuthorNativeCommandRequestV1,AuthorNativeCommandResultV1} from './roleplay-author-commands.js'
import type {AuthorMessageBodyRequestV1,AuthorMessageEditResultV1} from './roleplay-author-message-edit-types.js'
import type {OrdinaryAuthorChatUpdateV3,OrdinaryAuthorChatReceiptV3,
  OrdinaryAuthorChatBatchUpdateV3,OrdinaryAuthorChatBatchReceiptV3,OrdinaryAuthorChatBatchCommitV3}
  from './roleplay-author-chat-state-types.js'

export interface AuthorBrowserAttachmentV3 {
  readonly schemaVersion:1
  readonly encoding:'author-native-helper-attachment-v1'
  readonly binding:AuthorNativeBindingV1
  readonly program:AuthorNativeProgramV1
  readonly snapshot:AuthorNativeHelperSnapshotV1
  readonly parentOrigins:Readonly<Record<string,string>>
}
export type AuthorBrowserAttachment=AuthorBrowserAttachmentV3
export type AuthorBrowserSnapshot=AuthorNativeHelperSnapshotV1
export type AuthorBrowserWriteProgram=AuthorNativeProgramV1
/** Core selects the retained program and live realm. This address does not
 * claim which of that realm's mutually callable scripts made an async call. */
export interface AuthorNativeCallerV1 {readonly realmId:string}
export interface AuthorNativeNamespaceRequestV1 extends AuthorNativeCallerV1 {
  readonly operationId:string
  readonly read:{readonly kind:'snapshot';readonly readRevision:number}|{readonly kind:'generation';readonly invocationId:string}
  readonly nextVariables:Readonly<Record<string,MvuJsonValue>>
  readonly selector?:{readonly type:'message';readonly message_id?:number|'latest'}|{readonly type:'script'}
}
export type AuthorNativeNamespaceReplyV1=OrdinaryAuthorChatBatchCommitV3
export interface AuthorNativeGenerateRawRequestV1 extends AuthorNativeCallerV1 {
  readonly options:MvuJsonObject
  readonly operationId:string
}
export interface AuthorNativeGeneratedTaskV1 {
  readonly text:string
  readonly task:AuthorDialogTaskRefV1
}
export interface AuthorNativeWorldbookRequestV1 extends AuthorNativeCallerV1 {
  readonly name:string
  readonly operationId:string
  readonly expectedDataSha256:string
  readonly mutation:AuthorWorldbookMutationV1
}
export interface AuthorNativeWorldbookReplyV1 {
  readonly result:Pick<Extract<TavernLoreMutationResultV2,{kind:'edited-data'}>,'schemaVersion'|'kind'|'receipt'>
    |Extract<TavernLoreMutationResultV2,{kind:'refused'}>
  readonly worldbook?:readonly WorldbookEntryWireV1[]
  readonly new_entries?:readonly WorldbookEntryWireV1[]
  readonly deleted_entries?:readonly WorldbookEntryWireV1[]
}
export interface AuthorNativePersonaRequestV1 extends AuthorNativeCallerV1 {
  readonly operationId:string
  readonly expectedDataSha256:string
  readonly mutation:NativePersonaMutationV1
}
export interface AuthorNativePersonaReplyV1 {readonly result:NativePersonaMutationResultV1}
export interface AuthorNativeSaveRequestV1 extends AuthorNativeCallerV1 {
  readonly requestId:number
  readonly generation:string
  readonly readRevision:number
}
export type AuthorBrowserWorldbookMutationReply=AuthorNativeWorldbookReplyV1
  &{readonly snapshot?:AuthorBrowserSnapshot}
export type AuthorBrowserPersonaMutationReply=AuthorNativePersonaReplyV1
  &{readonly snapshot?:AuthorBrowserSnapshot}
export type AuthorBrowserRequest=
  |{action:'mutate-message-body';binding:AuthorNativeBindingV1;realmId:string;
    read:AuthorNativeNamespaceRequestV1['read'];request:AuthorMessageBodyRequestV1}
  |{action:'confirm-message-body';sessionId:string;operationId:string}
  |{action:'retry-message-body';binding:AuthorNativeBindingV1;realmId:string;
    sourceProgramSha256:string;request:AuthorMessageBodyRequestV1}
  |{action:'mutate-prompts';binding:AuthorNativeBindingV1;request:import('./author-native-helper-types.js').AuthorNativePromptMutationRequestV1}
  |{action:'filter-complete';binding:AuthorNativeBindingV1;result:import('./roleplay-author-browser-generation-types.js').BrowserFilterCompletion}
  |{action:'attach';sessionId:string;binding?:AuthorNativeBindingV1}
  |{action:'capture';binding:AuthorNativeBindingV1}
  |{action:'save';binding:AuthorNativeBindingV1;
    request:AuthorNativeSaveRequestV1;operation:MvuPlayerEditRequest}
  |{action:'mutate-opening-variants';binding:AuthorNativeBindingV1;realmId:string;
    read:AuthorNativeNamespaceRequestV1['read'];request:OpeningVariantMutationRequestV1}
  |{action:'confirm';operation:MvuPlayerEditRequest}
  |{action:'retry';operation:MvuPlayerEditRequest}
  |{action:'dispose';binding:AuthorNativeBindingV1}
  |{action:'generation-wait';binding:AuthorNativeBindingV1;registrations:readonly BrowserCallbackRegistration[]}
  |{action:'generation-complete';binding:AuthorNativeBindingV1;result:BrowserGenerationResult}
  |{action:'mvu-hook-complete';binding:AuthorNativeBindingV1;result:BrowserMvuHookCompletion}
  |{action:'generate-raw';binding:AuthorNativeBindingV1;request:AuthorNativeGenerateRawRequestV1}
  |{action:'execute-commands';binding:AuthorNativeBindingV1;realmId:string;request:AuthorNativeCommandRequestV1}
  |{action:'read-source-resource';binding:AuthorNativeBindingV1;request:AuthorScriptResourceRequestV1&AuthorNativeCallerV1}
  |{action:'mutate-worldbook';binding:AuthorNativeBindingV1;request:AuthorNativeWorldbookRequestV1}
  |{action:'retry-worldbook';sessionId:string;operationId:string;locator?:TavernLoreMutationRetryLocatorV1}
  |{action:'mutate-persona';binding:AuthorNativeBindingV1;request:AuthorNativePersonaRequestV1}
  |{action:'retry-persona';sessionId:string;operationId:string}
  |{action:'cleanup-prompts';binding:AuthorNativeBindingV1;request:BrowserPromptCleanupRequestV3}
  |{action:'mutate-author-namespace';binding:AuthorNativeBindingV1;request:AuthorNativeNamespaceRequestV1}
  |{action:'confirm-author-namespace';sessionId:string;operation:OrdinaryAuthorChatBatchUpdateV3}
  |{action:'retry-author-namespace';binding:AuthorNativeBindingV1;realmId:string;operation:OrdinaryAuthorChatBatchUpdateV3}
export type AuthorBrowserReply=
  |{ok:true;kind:'message-body-mutated';result:AuthorMessageEditResultV1;snapshot?:AuthorBrowserSnapshot}
  |{ok:true;kind:'message-body-confirmed';result:AuthorMessageEditResultV1}
  |{ok:true;kind:'prompts-mutated';retiredFilterCallbackIds?:readonly string[];snapshot?:AuthorBrowserSnapshot}
  |{ok:true;kind:'attached';attachment:AuthorBrowserAttachment}
  |{ok:true;kind:'inactive';code:string}
  |{ok:true;kind:'snapshot';snapshot:AuthorBrowserSnapshot}
  |{ok:true;kind:'saved';result:MvuPlayerEditResponse;snapshot?:AuthorBrowserSnapshot;
    sourceEvents?:readonly AuthorNativeSourceEventV1[]}
  |{ok:true;kind:'opening-variants-mutated';result:OpeningVariantMutationResult;snapshot?:AuthorBrowserSnapshot}
  |{ok:true;kind:'confirmed';result:MvuPlayerEditResponse}
  |{ok:true;kind:'disposed'}
  |{ok:true;kind:'generation-invocation';invocation:BrowserAuthorInvocation}
  |{ok:true;kind:'generation-acknowledged'}
  |{ok:true;kind:'generated';result:AuthorNativeGeneratedTaskV1}
  |{ok:true;kind:'commands-executed';result:AuthorNativeCommandResultV1;snapshot?:AuthorBrowserSnapshot}
  |{ok:true;kind:'source-resource';value:MvuJsonValue}
  |{ok:true;kind:'worldbook-mutated';reply:AuthorBrowserWorldbookMutationReply}
  |{ok:true;kind:'worldbook-retried';result:AuthorNativeWorldbookReplyV1['result']}
  |{ok:true;kind:'persona-mutated';reply:AuthorBrowserPersonaMutationReply}
  |{ok:true;kind:'persona-retried';result:AuthorNativePersonaReplyV1['result']}
  |{ok:false;code:string;error?:string}
  |{ok:true;kind:'prompts-cleaned'}
  |{ok:true;kind:'author-namespace-mutated';reply:AuthorNativeNamespaceReplyV1;snapshot?:AuthorBrowserSnapshot}
  |{ok:true;kind:'author-namespace-confirmed';receipt:OrdinaryAuthorChatBatchReceiptV3}
