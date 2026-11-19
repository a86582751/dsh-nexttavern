/** Browser HTTP payloads locate a private Core attachment. None is a Native
 * execution lease or a replacement for the numerical writer's own reservation. */
import type {AuthorNativeBindingV1,AuthorNativeSourceEventV1} from './author-native-helper-types.js'
import type {AuthorNativeProgramV1} from './author-native-program.mjs'
import type {AuthorNativeHelperSnapshotV1} from './author-native-helper-types.js'
import type {MvuPlayerEditRequest,MvuPlayerEditResponse} from './roleplay-mvu-player-types.js'
import type {AuthorDialogTaskRefV1} from './roleplay-author-dialog.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {AuthorWorldbookMutationV1,AuthorWorldbookReadTargetV1,AuthorWorldbookRetryLocatorV1,
  AuthorWorldbookResultV1,AuthorWorldbookManagementV1} from './roleplay-author-worldbook-data.js'
import type {AuthorWorldbookHelperCaptureV1,AuthorWorldbookBindingCaptureV1,
  AuthorWorldbookReadErrorV1} from './roleplay-author-worldbook-types.js'
import type {WorldbookEntryWireV1} from './tavern-named-worldbook-data.js'
import type {NativePersonaMutationV1,NativePersonaMutationResultV1} from './roleplay-native-persona-types.js'
import type {BrowserCallbackRegistration,BrowserAuthorInvocation,BrowserGenerationResult,BrowserPromptCleanupRequestV3,
  BrowserMvuHookCompletion}
  from './roleplay-author-browser-generation-types.js'
import type {MvuJsonValue} from './tavern-mvu-initvar.js'
import type {AuthorScriptResourceRequestV1} from './roleplay-author-script-resources.js'
import type {OpeningVariantMutationRequestV1} from './roleplay-opening-variant-types.js'
import type {OpeningVariantMutationResult} from './roleplay-opening-variants.js'
import type {AuthorNativeCommandRequestV1,AuthorNativeCommandResultV1} from './roleplay-author-commands.js'
import type {AuthorMessageBodyRequestV1,AuthorMessageEditResultV1} from './roleplay-author-message-edit-types.js'
import type {OrdinaryAuthorChatBatchReceiptV3,OrdinaryAuthorChatBatchCommitV3}
  from './roleplay-author-chat-state-types.js'
import type {AuthorSharedScopeSelectorV1,AuthorOrdinaryNamespaceOperationV1} from './roleplay-author-scope-owner.js'
import type {AuthorPersistentScopeCommitV1,AuthorPersistentScopeReceiptV1} from './roleplay-author-scope-types.js'
import type {CommunityAuthorPresetCatalogV1,CommunityAuthorPresetOperationV1,CommunityAuthorPresetResultV1}
  from './community-preset-types.js'
import type {AuthorCharacterLibraryPacketV1} from './roleplay-author-character-library.js'
import type {AuthorSourceContextRegistrationV1} from './roleplay-author-source-context.js'
import type {AuthorWorldbookRefV1} from './roleplay-author-worldbook-types.js'
import type {TavernAuthorMetadataMutationResultV1,TavernAuthorMetadataRetryResultV1}
  from './roleplay-tavern-lore-edits-types.js'

export interface AuthorNativeCharacterLibraryTargetV1 extends AuthorNativeCallerV1 {
  readonly operationId:string
  readonly ownerSessionId:string
  readonly target:AuthorSourceContextRegistrationV1
}
export interface AuthorNativeCharacterRegexRequestV1 extends AuthorNativeCharacterLibraryTargetV1 {
  readonly epoch?:string
  readonly expectedSourceSha256:string
  readonly expectedRevision:number
  readonly identitySha256:string
  readonly rules:readonly Readonly<Record<string,MvuJsonValue>>[]
}
export interface AuthorNativeNamedCharacterWorldbookRequestV1 extends AuthorNativeCharacterLibraryTargetV1 {
  readonly epoch:string
  readonly expectedHead:AuthorWorldbookRefV1|null
  readonly selection:Extract<AuthorWorldbookBindingCaptureV1['selection'],{kind:'character'}>
}
export type AuthorNativeCharacterLibraryMutationV1=
  |{readonly kind:'character-regex-replace';readonly request:AuthorNativeCharacterRegexRequestV1}
  |{readonly kind:'named-character-worldbook-bind';readonly request:AuthorNativeNamedCharacterWorldbookRequestV1}
export type AuthorNativeCharacterLibraryMutationResultV1=AuthorWorldbookResultV1|TavernAuthorMetadataMutationResultV1
  |TavernAuthorMetadataRetryResultV1

export interface AuthorBrowserAttachmentV3 {
  readonly schemaVersion:1
  readonly encoding:'author-native-helper-attachment-v1'
  readonly binding:AuthorNativeBindingV1
  readonly program:AuthorNativeProgramV1
  readonly snapshot:AuthorNativeHelperSnapshotV1
  readonly parentOrigins:Readonly<Record<string,string>>
  readonly authorScene?:import('./author-native-helper-types.js').AuthorNativeSceneV1
  readonly sceneTopOffsets?:Readonly<Record<number,readonly number[]>>
  readonly presetLibrary?:CommunityAuthorPresetCatalogV1
  readonly characterLibrary?:AuthorCharacterLibraryPacketV1
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
  readonly selector?:{readonly type:'message';readonly message_id?:number|'latest'}|{readonly type:'script'}|AuthorSharedScopeSelectorV1
}
export type AuthorNativeNamespaceReplyV1=OrdinaryAuthorChatBatchCommitV3|AuthorPersistentScopeCommitV1
export type AuthorNativeNamespaceReceiptV1=OrdinaryAuthorChatBatchReceiptV3|AuthorPersistentScopeReceiptV1
export interface AuthorNativeGenerateRawRequestV1 extends AuthorNativeCallerV1 {
  readonly options:MvuJsonObject
  readonly operationId:string
  readonly libraryReads?:readonly import('./author-native-helper-types.js').AuthorNativeRealmLibraryReadV1[]
}
export interface AuthorNativeGeneratedTaskV1 {
  readonly text:string
  readonly task:AuthorDialogTaskRefV1
  readonly details:{readonly content:string;readonly reasoning?:string;readonly reasoning_signature?:string;
    readonly tool_calls?:readonly {readonly id:string;readonly type:'function';
      readonly function:{readonly name:string;readonly arguments:string};readonly thought_signature?:string}[]}
}
export interface AuthorNativeGenerationUpdateV1 {
  readonly cursor:number
  readonly deltas:readonly {readonly kind:'text'|'reasoning';readonly delta:string}[]
  readonly settled:boolean
  readonly result?:AuthorNativeGeneratedTaskV1
  readonly error?:string
  readonly filter?:{readonly invocationId:string;
    readonly descriptor:import('./author-native-helper-types.js').AuthorNativeGenerationFilterV1;readonly consumer:'scan'|'chat'}
}
export interface AuthorNativeWorldbookRequestV1 extends AuthorNativeCallerV1 {
  readonly name:string
  readonly operationId:string
  readonly expectedDataSha256:string
  readonly target:AuthorWorldbookReadTargetV1
  readonly read:AuthorNativeNamespaceRequestV1['read']
  readonly mutation:AuthorWorldbookMutationV1
}
export interface AuthorNativeWorldbookReplyV1 {
  readonly result:AuthorWorldbookResultV1
  readonly readError?:AuthorWorldbookReadErrorV1
  /** The returned entries belong to the accompanying snapshot's captured book. */
  readonly worldbookReadCurrent?:true
  readonly target?:AuthorWorldbookReadTargetV1
  readonly worldbook?:readonly WorldbookEntryWireV1[]
  readonly new_entries?:readonly WorldbookEntryWireV1[]
  readonly deleted_entries?:readonly WorldbookEntryWireV1[]
  readonly deletedBookId?:string
  readonly bindings?:AuthorWorldbookBindingCaptureV1
}
export interface AuthorNativeWorldbookManagementRequestV1 extends AuthorNativeCallerV1 {
  readonly operationId:string
  readonly expectedDataSha256:string
  readonly read:AuthorNativeNamespaceRequestV1['read']
  readonly mutation:AuthorWorldbookManagementV1
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
  |{action:'mvu-trial';binding:AuthorNativeBindingV1;realmId:string;
    request:import('./roleplay-author-mvu-trial.js').AuthorMvuTrialRequestV1}
  |{action:'ack-library-reads';binding:AuthorNativeBindingV1;
    captures:readonly (import('./author-native-helper-types.js').AuthorNativeLibraryReadCaptureV1&{readonly realmId:string})[]}
  |{action:'character-regex-replace';binding:AuthorNativeBindingV1;request:AuthorNativeCharacterRegexRequestV1}
  |{action:'named-character-worldbook-bind';binding:AuthorNativeBindingV1;request:AuthorNativeNamedCharacterWorldbookRequestV1}
  |{action:'retry-character-library';sessionId:string;operation:AuthorNativeCharacterLibraryMutationV1}
  |{action:'mutate-script-buttons';binding:AuthorNativeBindingV1;
    request:import('./author-native-helper-types.js').AuthorNativeScriptButtonsRequestV1}
  |{action:'mutate-message-body';binding:AuthorNativeBindingV1;realmId:string;
    read:AuthorNativeNamespaceRequestV1['read'];request:AuthorMessageBodyRequestV1}
  |{action:'confirm-message-body';sessionId:string;operationId:string}
  |{action:'retry-message-body';binding:AuthorNativeBindingV1;realmId:string;
    sourceProgramSha256:string;request:AuthorMessageBodyRequestV1}
  |{action:'mutate-prompts';binding:AuthorNativeBindingV1;request:import('./author-native-helper-types.js').AuthorNativePromptMutationRequestV1}
  |{action:'filter-complete';binding:AuthorNativeBindingV1;result:import('./roleplay-author-browser-generation-types.js').BrowserFilterCompletion}
  |{action:'attach';sessionId:string;binding?:AuthorNativeBindingV1;characterEpoch?:string;presetRevision?:number;openingIndex?:number}
  |{action:'capture';binding:AuthorNativeBindingV1}
  |{action:'save';binding:AuthorNativeBindingV1;
    request:AuthorNativeSaveRequestV1;operation:MvuPlayerEditRequest}
  |{action:'mutate-opening-variants';binding:AuthorNativeBindingV1;realmId:string;
    read:AuthorNativeNamespaceRequestV1['read'];request:OpeningVariantMutationRequestV1}
  |{action:'confirm';operation:MvuPlayerEditRequest}
  |{action:'retry';operation:MvuPlayerEditRequest}
  |{action:'dispose';binding:AuthorNativeBindingV1}
  |{action:'generation-wait';binding:AuthorNativeBindingV1;registrations:readonly BrowserCallbackRegistration[];
    registrationRevision?:number;sourceCursor?:string}
  |{action:'generation-registrations';binding:AuthorNativeBindingV1;registrations:readonly BrowserCallbackRegistration[];
    registrationRevision:number}
  |{action:'generation-complete';binding:AuthorNativeBindingV1;result:BrowserGenerationResult}
  |{action:'mvu-hook-complete';binding:AuthorNativeBindingV1;result:BrowserMvuHookCompletion}
  |{action:'generate-raw';binding:AuthorNativeBindingV1;request:AuthorNativeGenerateRawRequestV1}
  |{action:'start-author-generation';binding:AuthorNativeBindingV1;request:AuthorNativeGenerateRawRequestV1}
  |{action:'author-generation-next';binding:AuthorNativeBindingV1;
    request:{readonly realmId:string;readonly operationId:string;readonly cursor:number}}
  |{action:'stop-author-generation';binding:AuthorNativeBindingV1;
    request:{readonly realmId:string;readonly operationId:string}}
  |{action:'author-generation-filter-result';binding:AuthorNativeBindingV1;
    request:{readonly realmId:string;readonly operationId:string;readonly invocationId:string;readonly accepted:boolean;
      readonly error?:string;readonly libraryReads?:readonly import('./author-native-helper-types.js').AuthorNativeRealmLibraryReadV1[]}}
  |{action:'execute-commands';binding:AuthorNativeBindingV1;realmId:string;request:AuthorNativeCommandRequestV1}
  |{action:'read-source-resource';binding:AuthorNativeBindingV1;request:AuthorScriptResourceRequestV1&AuthorNativeCallerV1}
  |{action:'mutate-worldbook';binding:AuthorNativeBindingV1;request:AuthorNativeWorldbookRequestV1}
  |{action:'manage-worldbook';binding:AuthorNativeBindingV1;request:AuthorNativeWorldbookManagementRequestV1}
  |{action:'manage-preset';binding:AuthorNativeBindingV1;realmId:string;operation:CommunityAuthorPresetOperationV1}
  |{action:'read-worldbook';binding:AuthorNativeBindingV1;realmId:string;name:string;
    expectedDataSha256:string;read:AuthorNativeNamespaceRequestV1['read']}
  |{action:'retry-worldbook';sessionId:string;operationId:string;locator?:AuthorWorldbookRetryLocatorV1}
  |{action:'mutate-persona';binding:AuthorNativeBindingV1;request:AuthorNativePersonaRequestV1}
  |{action:'retry-persona';sessionId:string;operationId:string}
  |{action:'cleanup-prompts';binding:AuthorNativeBindingV1;request:BrowserPromptCleanupRequestV3}
  |{action:'mutate-author-namespace';binding:AuthorNativeBindingV1;request:AuthorNativeNamespaceRequestV1}
  |{action:'confirm-author-namespace';sessionId:string;operation:AuthorOrdinaryNamespaceOperationV1}
  |{action:'retry-author-namespace';binding:AuthorNativeBindingV1;realmId:string;operation:AuthorOrdinaryNamespaceOperationV1}
export type AuthorBrowserReply=(
  |{ok:true;kind:'mvu-trial';result:import('./roleplay-author-mvu-trial.js').AuthorMvuTrialReplyV1}
  |{ok:true;kind:'library-reads-acknowledged'}
  |{ok:true;kind:'character-library-mutated';value:AuthorNativeCharacterLibraryMutationResultV1;snapshot?:AuthorBrowserSnapshot}
  |{ok:true;kind:'script-buttons-mutated';result:import('./roleplay-tavern-lore-edits-types.js').TavernAuthorMetadataMutationResultV1;
    snapshot?:AuthorBrowserSnapshot}
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
  |{ok:true;kind:'generation-started';operationId:string;generationId:string}
  |{ok:true;kind:'generation-update';update:AuthorNativeGenerationUpdateV1}
  |{ok:true;kind:'generation-stopped';stopped:boolean}
  |{ok:true;kind:'generation-filter-acknowledged'}
  |{ok:true;kind:'commands-executed';result:AuthorNativeCommandResultV1;snapshot?:AuthorBrowserSnapshot}
  |{ok:true;kind:'source-resource';value:MvuJsonValue}
  |{ok:true;kind:'worldbook-mutated';reply:AuthorBrowserWorldbookMutationReply}
  |{ok:true;kind:'worldbook-managed';reply:AuthorBrowserWorldbookMutationReply}
  |{ok:true;kind:'preset-managed';result:CommunityAuthorPresetResultV1;catalog:CommunityAuthorPresetCatalogV1;
    snapshot?:AuthorBrowserSnapshot}
  |{ok:true;kind:'preset-refused';operationId:string;code:string}
  |{ok:true;kind:'worldbook-read';book:AuthorWorldbookHelperCaptureV1}
  |{ok:true;kind:'worldbook-retried';result:AuthorNativeWorldbookReplyV1['result']}
  |{ok:true;kind:'persona-mutated';reply:AuthorBrowserPersonaMutationReply}
  |{ok:true;kind:'persona-retried';result:AuthorNativePersonaReplyV1['result']}
  |{ok:false;code:string;error?:string}
  |{ok:true;kind:'prompts-cleaned'}
  |{ok:true;kind:'author-namespace-mutated';reply:AuthorNativeNamespaceReplyV1;snapshot?:AuthorBrowserSnapshot}
  |{ok:true;kind:'author-namespace-confirmed';receipt:AuthorNativeNamespaceReceiptV1}
)&{readonly characterLibrary?:AuthorCharacterLibraryPacketV1}
