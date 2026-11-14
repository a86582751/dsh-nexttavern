import type {AuthorNativeProgramV1} from './author-native-program.mjs'
import type {ReaderDocumentLayoutSettings} from './tavern-author-reader-document-layout.js'
import type {MvuJsonObject,MvuJsonValue} from './tavern-mvu-initvar.js'
import type {MvuMessageTargetV1,MvuPlayerEditExpected} from './roleplay-mvu-player-types.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'
import type {PromptCapturedMessageV1} from './tavern-author-prompt-types.mjs'
import type {AuthorNamedWorldbookDataV1,AuthorNamedWorldbookDataV2} from './roleplay-author-worldbook-data.js'
import type {NativePersonaDataV1,NativeBrowserCharacterV1} from './roleplay-native-persona-types.js'
import type {CanonicalAuthorChatStateV1} from './roleplay-author-chat-state.js'
import type {AuthorNativeMvuHookRequest,AuthorNativeMvuHookResult} from './author-native-mvu-hook-types.js'

export interface AuthorNativeBindingV1 {
  readonly browserSessionId:string
  readonly generation:string
  readonly sessionId:string
  readonly programSha256:string
}
export interface AuthorNativeDiagnosticV1 {
  readonly code:string
  readonly scriptIdentity?:string
  readonly pointer?:string
  readonly ordinal?:number
  readonly line?:number
  readonly column?:number
  readonly feature?:string
}
export interface AuthorNativeChatMessageSnapshotV1 {
  readonly position:number
  readonly ownerSessionId:string
  readonly nativeSeq:number
  readonly messageId:string
  readonly messageVersionSha256:string
  readonly selectedVariant:string
  readonly role:'user'|'assistant'
  readonly text:string
}
export type AuthorNativeNumericalSnapshotV1=
  |{readonly kind:'ready'|'schema-ready';readonly values:MvuJsonObject;
    readonly expected:MvuPlayerEditExpected;readonly canEdit:boolean;readonly editBlockCode?:string;
    readonly currentMessageCarrier?:MvuMessageTargetV1}
  |{readonly kind:'blocked'|'unknown';readonly code:string;readonly canEdit:false}
/** Actual Core capture DATA shared by helpers and the independent Reader. */
export type AuthorNativeTavernRegexV1=Readonly<Record<string,MvuJsonValue>>
/** Standard DTOs from each actual owner, distinct from execution rule IDs.
 * An absent scope means unavailable; an owned empty catalogue is an empty list. */
export interface AuthorNativeCurrentTavernRegexesV1 {
  readonly global?:readonly AuthorNativeTavernRegexV1[]
  readonly character?:{readonly name:string;readonly rules:readonly AuthorNativeTavernRegexV1[]}
}
export interface AuthorNativeSnapshotDataV1 {
  readonly readonlyPreset?:import('./community-presets.js').CommunityReadonlyPresetV1
  readonly tavernRegexes?:AuthorNativeCurrentTavernRegexesV1
  /** Loadable owner-selected DATA for opaque realms; persona/card avatar IDs
   * remain their original Native fields and are never interpreted as URLs. */
  readonly avatarPaths?:{readonly user:string|null;readonly character:string|null}
  readonly generation:string
  readonly readRevision:number
  readonly basis:{readonly sessionId:string;readonly sourceSnapshotSha256:string;
    readonly materialSha256:string;readonly numericalSnapshotSha256:string;
    readonly nativeCut:number;readonly nativePrefixSha256:string}
  readonly scopeFrame:MvuScopeReadFrameV1
  readonly messages:readonly PromptCapturedMessageV1[]
  readonly numerical:AuthorNativeNumericalSnapshotV1
  readonly persona:{readonly name:string;readonly gender?:string;readonly avatar:string|null}
  readonly worldbook?:Omit<AuthorNamedWorldbookDataV1,'members'>|Omit<AuthorNamedWorldbookDataV2,'members'>
  readonly personas?:NativePersonaDataV1
  readonly character?:NativeBrowserCharacterV1
  readonly ordinaryChat:ReturnType<CanonicalAuthorChatStateV1['captureNamespaceV3']>
  readonly ordinaryMessages?:readonly import('./tavern-author-prompt-types.mjs').AuthorOrdinaryMessageCaptureV1[]
  readonly ordinaryPublicationSeq?:number|null
}
export interface AuthorNativeComposerAccessV1 {
  read():string
  replace(text:string,expectedText:string):void
  overwrite(text:string):void
  dispatch(type:'input'|'change'):void
  focus():void
}
export interface AuthorNativeSourceEventV1 {
  readonly type:string
  readonly args:readonly unknown[]
}
export interface AuthorNativeHelperSnapshotV1 extends AuthorNativeSnapshotDataV1 {
  readonly schemaVersion:1
  readonly encoding:'author-native-helper-snapshot-v1'
  readonly context?:Readonly<Record<string,unknown>>
}
/** Effective ordinary data for the actual single enabled script in a realm.
 * Source resource reads retain their separate immutable descriptor DATA. */
export interface AuthorNativeSelfScriptV1 {
  readonly identity:string
  readonly id:string
  readonly descriptorSha256:string
  readonly sourceSnapshotSha256:string
  readonly originalOrdinal:number
  readonly variables?:MvuJsonObject
  readonly ordinary:ReturnType<CanonicalAuthorChatStateV1['captureNamespaceV3']>
}
export interface AuthorNativeHelperRealmBindingV1 {
  readonly realmId:string
  readonly groupId:string
}
/** Resource addresses locate Source data; they never change the realm principal. */
export interface AuthorNativeHelperRequestV1 {
  readonly operationId:string
  readonly operation:string
  readonly payload:unknown
  readonly readScope?:string
}
export interface AuthorNativeHelperReplyV1 {
  readonly value?:unknown
  readonly snapshot?:AuthorNativeHelperSnapshotV1
  readonly readScope?:string
}
export interface AuthorNativeHelperHostV1 {
  request(binding:AuthorNativeHelperRealmBindingV1,request:AuthorNativeHelperRequestV1,
    signal:AbortSignal):Promise<AuthorNativeHelperReplyV1>
}
export interface AuthorNativeHelperFrameOptionsV1 {
  readonly parentOrigin:string
  readonly resource:AuthorNativeHelperResourceV1
  readonly documentLayout?:ReaderDocumentLayoutSettings
  readonly libraries?:readonly {readonly javascript:string}[]
  current():boolean
  failed?(code:string):void
}
export interface AuthorNativeHelperFrameControllerV1 {
  readonly started:Promise<void>
  readonly disposed:Promise<void>
  readonly hardTermination:'unavailable'
  updateSnapshot(snapshot:AuthorNativeHelperSnapshotV1,readScope:string):void
  dispatchEvent(event:string,args:readonly unknown[],resource?:string,callbackId?:string):void
  waitForAdmittedSourceWrites():Promise<void>
  generationCallbacks():Promise<readonly AuthorNativeHelperGenerationCallbackV1[]>
  invokeGeneration(invocation:AuthorNativeHelperGenerationInvocationV1,
    signal:AbortSignal):Promise<AuthorNativeHelperGenerationResultV1>
  invokeFilter(invocation:AuthorNativeFilterInvocationV1,signal:AbortSignal):Promise<boolean>
  retireFilterCallbacks(ids:readonly string[]):void
  invokeMvuHook(invocation:{readonly invocationId:string;readonly request:AuthorNativeMvuHookRequest;
    readonly callbackIds:readonly string[]},signal:AbortSignal):Promise<AuthorNativeHelperMvuHookResultV1>
  dispose():void
}
export interface AuthorNativeInjectionPromptV1 {
  readonly id:string;readonly position:'in_chat'|'none';readonly depth:number
  readonly role:'system'|'user'|'assistant';readonly content:string;readonly should_scan:boolean
  readonly filterCallbackId?:string
}
export interface AuthorNativePromptMutationRequestV1 {
  readonly operationId:string;readonly realmId:string;readonly resource:AuthorNativeHelperResourceV1
  readonly mutation:{readonly kind:'register';readonly prompts:readonly AuthorNativeInjectionPromptV1[];readonly once:boolean}
    |{readonly kind:'remove-ids';readonly ids:readonly string[];readonly registrationOperationId?:string}
}
export interface AuthorNativeFilterInvocationV1 {
  readonly operationId:string;readonly registrationId:string;readonly consumer:'scan'|'chat'
  readonly realmId:string;readonly resource:AuthorNativeHelperResourceV1;readonly filterCallbackId:string
  readonly snapshot:AuthorNativeHelperSnapshotV1;readonly readScope:string
}
export interface AuthorNativeHelperResourceV1 {
  readonly browserSessionId:string
  readonly generation:string
  readonly pageId:string
}
export interface AuthorNativeHelperGenerationCallbackV1 {
  readonly callbackId:string
  readonly realmId:string
  readonly resource:AuthorNativeHelperResourceV1
  readonly event:string
  readonly once:boolean
  readonly makeFirst:boolean
  readonly order:number
}
export interface AuthorNativeHelperGenerationInvocationV1 {
  readonly invocationId:string
  readonly event:string
  readonly args:readonly unknown[]
  readonly callbackIds?:readonly string[]
  readonly snapshot?:AuthorNativeHelperSnapshotV1
  readonly readScope?:string
}
export type AuthorNativeHelperGenerationEffectV1=({readonly kind:'inject';readonly prompts:readonly unknown[];
  readonly once:boolean}|{readonly kind:'remove';readonly ids:readonly string[]}) & {
  readonly callbackId:string
  readonly realmId:string
  readonly resource:AuthorNativeHelperResourceV1
}
export interface AuthorNativeHelperGenerationResultV1 {
  readonly invocationId:string
  readonly callbackIds:readonly string[]
  readonly effects:readonly AuthorNativeHelperGenerationEffectV1[]
}
export type AuthorNativeHelperProgramV1=AuthorNativeProgramV1
export interface AuthorNativeHelperMvuHookResultV1 {
  readonly invocationId:string
  readonly callbackIds:readonly string[]
  readonly result:AuthorNativeMvuHookResult
}
