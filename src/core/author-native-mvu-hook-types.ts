/** Browser event DATA only. Closing ownership and journal acceptance remain in
 * Core; these addresses never grant a numerical or message writer permission. */
import type {AuthorNativeBindingV1,AuthorNativeHelperGenerationCallbackV1} from './author-native-helper-types.js'
import type {MvuMessageTargetV1} from './roleplay-mvu-player-types.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'

export type AuthorNativeMvuHookStage='command-parsed'|'update-ended'|'before-message-update'
/** Public MVU vocabulary. Args retain literal text, not normalized Native ops. */
export interface AuthorNativeMvuCommandInfo {
  readonly type:'set'|'insert'|'delete'|'add'|'move'
  readonly full_match:string
  readonly args:readonly string[]
  readonly reason:string
}
export interface AuthorNativeMvuHookPayloads {
  'command-parsed':{readonly variables:MvuJsonObject;readonly commands:readonly AuthorNativeMvuCommandInfo[];
    readonly message_content:string}
  'update-ended':{readonly variables:MvuJsonObject;readonly variables_before_update:MvuJsonObject}
  'before-message-update':{readonly context:{readonly variables:MvuJsonObject;readonly message_content:string}}
}
export interface AuthorNativeMvuHookOutputs {
  'command-parsed':Pick<AuthorNativeMvuHookPayloads['command-parsed'],'variables'|'commands'>
  'update-ended':Pick<AuthorNativeMvuHookPayloads['update-ended'],'variables'>
  'before-message-update':AuthorNativeMvuHookPayloads['before-message-update']
}
export type AuthorNativeMvuHookRequest={
  [S in AuthorNativeMvuHookStage]:{readonly sessionId:string;readonly planSha256:string;
    readonly target:MvuMessageTargetV1;readonly stage:S;readonly payload:AuthorNativeMvuHookPayloads[S]}
}[AuthorNativeMvuHookStage]
export interface AuthorNativeMvuHookIdentity {
  readonly invocationId:string
  readonly programSha256:string
  readonly binding:AuthorNativeBindingV1
  readonly registrations:readonly (Pick<AuthorNativeHelperGenerationCallbackV1,'realmId'|'callbackId'|'resource'>
    &{readonly groupId:string})[]
}
export interface AuthorNativeMvuHookDiagnostic {readonly code:string;readonly realmId?:string;readonly callbackId?:string}
export type AuthorNativeMvuHookResult={
  [S in AuthorNativeMvuHookStage]:{readonly stage:S;readonly output:AuthorNativeMvuHookOutputs[S];
    readonly diagnostics:readonly AuthorNativeMvuHookDiagnostic[]}
}[AuthorNativeMvuHookStage]
/** Preparation reserves actual registrations but sends no Browser challenge.
 * execute is released only after the journal's durable dispatch marker. */
export interface AuthorNativeMvuPreparedHook {
  readonly identity:AuthorNativeMvuHookIdentity
  execute():Promise<AuthorNativeMvuHookResult>
  dispose():void
}
export type PrepareAuthorNativeMvuHook=(request:AuthorNativeMvuHookRequest,signal:AbortSignal)=>
  Promise<AuthorNativeMvuPreparedHook|undefined>
