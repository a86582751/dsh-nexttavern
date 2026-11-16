/** Browser event DATA only. Closing ownership and journal acceptance remain in
 * Core; these addresses never grant a numerical or message writer permission. */
import type {AuthorNativeBindingV1,AuthorNativeHelperGenerationCallbackV1} from './author-native-helper-types.js'
import type {MvuMessageTargetV1} from './roleplay-mvu-player-types.js'
import type {AuthorNativeMvuHookGraphV1} from './author-native-mvu-hook-graph.js'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'

export const AUTHOR_NATIVE_MVU_HOOK_EVENTS={
  'initialized':'mag_variable_initialized',
  'update-started':'mag_variable_update_started','single-variable-updated':'mag_variable_updated',
  'command-parsed':'mag_command_parsed','update-ended':'mag_variable_update_ended',
  'command-parsed-for-zod':'mag_command_parsed_for_zod',
  'command-parsed-ended-for-zod':'mag_command_parsed_ended_for_zod',
  'update-ended-for-zod':'mag_variable_update_ended_for_zod',
  'before-message-update':'mag_before_message_update',
} as const
export type AuthorNativeMvuHookStage=keyof typeof AUTHOR_NATIVE_MVU_HOOK_EVENTS
/** Public MVU vocabulary. Args retain literal text, not normalized Native ops. */
export interface AuthorNativeMvuCommandInfo {
  readonly type:'set'|'insert'|'assign'|'remove'|'unset'|'delete'|'add'|'move'
  readonly full_match:string
  readonly args:readonly string[]
  readonly reason:string
}
export interface AuthorNativeMvuHookReadVariablesV1 {
  readonly schemaVersion:1
  readonly values:MvuJsonObject
  readonly deletedKeys?:readonly string[]
  readonly appliedWrites?:AuthorNativeMvuContextWritesV1
}
export interface AuthorNativeMvuHookPayloads {
  'initialized':{readonly graph:AuthorNativeMvuHookGraphV1;readonly readVariables?:AuthorNativeMvuHookReadVariablesV1}
  'command-parsed-for-zod':{readonly graph:AuthorNativeMvuHookGraphV1;readonly readVariables?:AuthorNativeMvuHookReadVariablesV1}
  'command-parsed-ended-for-zod':{readonly graph:AuthorNativeMvuHookGraphV1;readonly readVariables?:AuthorNativeMvuHookReadVariablesV1}
  'update-ended-for-zod':{readonly graph:AuthorNativeMvuHookGraphV1;readonly readVariables?:AuthorNativeMvuHookReadVariablesV1}
  'update-started':{readonly graph:AuthorNativeMvuHookGraphV1;readonly readVariables?:AuthorNativeMvuHookReadVariablesV1}
  'single-variable-updated':{readonly graph:AuthorNativeMvuHookGraphV1;readonly readVariables?:AuthorNativeMvuHookReadVariablesV1}
  'command-parsed':{readonly graph?:AuthorNativeMvuHookGraphV1;readonly variables?:MvuJsonObject;readonly commands?:readonly AuthorNativeMvuCommandInfo[];
    readonly message_content?:string;readonly readVariables?:AuthorNativeMvuHookReadVariablesV1}
  'update-ended':{readonly graph?:AuthorNativeMvuHookGraphV1;readonly variables?:MvuJsonObject;readonly variables_before_update?:MvuJsonObject;
    readonly readVariables?:AuthorNativeMvuHookReadVariablesV1}
  'before-message-update':{readonly context:{readonly variables:MvuJsonObject;readonly message_content:string};
    readonly readVariables?:AuthorNativeMvuHookReadVariablesV1}
}
export interface AuthorNativeMvuHookOutputs {
  'initialized':{readonly graph:AuthorNativeMvuHookGraphV1}
  'command-parsed-for-zod':{readonly graph:AuthorNativeMvuHookGraphV1}
  'command-parsed-ended-for-zod':{readonly graph:AuthorNativeMvuHookGraphV1}
  'update-ended-for-zod':{readonly graph:AuthorNativeMvuHookGraphV1}
  'update-started':{readonly graph:AuthorNativeMvuHookGraphV1}
  'single-variable-updated':{readonly graph:AuthorNativeMvuHookGraphV1}
  'command-parsed':Pick<AuthorNativeMvuHookPayloads['command-parsed'],'variables'|'commands'|'graph'>
  'update-ended':Pick<AuthorNativeMvuHookPayloads['update-ended'],'variables'|'graph'>
  'before-message-update':Pick<AuthorNativeMvuHookPayloads['before-message-update'],'context'>
}
export interface AuthorNativeMvuOpeningTargetV1 {
  readonly kind:'opening'
  readonly ownerSessionId:string
  readonly operationId:string
  readonly messageId:string
  readonly selectedSwipeIdentity:string
  readonly swipeIndex:number
}
export type AuthorNativeMvuHookTargetV1=MvuMessageTargetV1|AuthorNativeMvuOpeningTargetV1
export type AuthorNativeMvuHookRequest={
  [S in AuthorNativeMvuHookStage]:{readonly sessionId:string;readonly planSha256:string;
    readonly target:AuthorNativeMvuHookTargetV1;readonly yieldOrdinal?:number;readonly stage:S;readonly payload:AuthorNativeMvuHookPayloads[S]}
}[AuthorNativeMvuHookStage]
export interface AuthorNativeMvuHookIdentity {
  readonly invocationId:string
  readonly programSha256:string
  readonly binding:AuthorNativeBindingV1
  readonly registrations:readonly (Pick<AuthorNativeHelperGenerationCallbackV1,'realmId'|'callbackId'|'resource'>
    &{readonly groupId:string})[]
}
export interface AuthorNativeMvuHookDiagnostic {readonly code:string;readonly realmId?:string;readonly callbackId?:string}
export type AuthorNativeMvuContextWritesV1=
  |{readonly schemaVersion:1;readonly kind:'keys';readonly keys:readonly string[]}
  |{readonly schemaVersion:1;readonly kind:'replace'}
export type AuthorNativeMvuHookResult={
  [S in AuthorNativeMvuHookStage]:{readonly stage:S;readonly output:AuthorNativeMvuHookOutputs[S];
    readonly contextWrites?:AuthorNativeMvuContextWritesV1;
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
