/** Live Browser generation DATA shares the actual Core preparation capture.
 * Its binding and receipts locate an invocation; the pending Core owner decides
 * whether an execution result may enter the injection registry. */
import type {AuthorNativeBindingV1 as BrowserBindingV1} from './author-native-helper-types.js'
import type {AuthorNativeProgramV1,AuthorNativeRealmV1} from './author-native-program.mjs'
import type {AuthorNativeFilterInvocationV1,AuthorNativeHelperSnapshotV1,AuthorNativeHelperGenerationResultV1,
  AuthorNativeHelperGenerationCallbackV1} from './author-native-helper-types.js'
import type {AuthorInjectionResourceV1} from 'dsh-nexttavern-session-format/author-injection-cleanup'
import type {AuthorPromptOpeningFactsV1} from './roleplay-author-prompt-capture.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'
import type {AuthorPromptInjectionV1,PromptCaptureV1,PromptDiagnosticV1} from './tavern-author-prompt-types.mjs'
import type {AuthorNativeMvuHookRequest,AuthorNativeMvuHookIdentity,AuthorNativeMvuHookResult}
  from './author-native-mvu-hook-types.js'

export interface AuthorBrowserPreparationFactsV3 {
  readonly program:AuthorNativeProgramV1
  readonly opening:AuthorPromptOpeningFactsV1
  readonly scopes:MvuScopeReadFrameV1
  readonly basis:Pick<AuthorNativeHelperSnapshotV1['basis'],'materialSha256'|'numericalSnapshotSha256'>
  readonly numerical:AuthorNativeHelperSnapshotV1['numerical']
  readonly persona:AuthorNativeHelperSnapshotV1['persona']
  readonly ordinaryChat:AuthorNativeHelperSnapshotV1['ordinaryChat']
  readonly ordinaryMessages?:AuthorNativeHelperSnapshotV1['ordinaryMessages']
}
/** Array order is the guest registry's actual order, including eventMakeFirst.
 * All mutually callable Source units in a realm share its actual principal. */
export type BrowserCallbackRegistrationV3=AuthorNativeHelperGenerationCallbackV1
export interface BrowserPromptResourceV3 extends AuthorInjectionResourceV1 {
  readonly pageId:string
}
export type BrowserPromptCleanupRequestV3={readonly resource:BrowserPromptResourceV3}&(
  |{readonly kind:'remove-ids';readonly ids:readonly string[]}
  |{readonly kind:'resource-closed'})
export type BrowserEffectV3=AuthorNativeRealmV1&{
  readonly callbackId:string;readonly resource:BrowserPromptResourceV3
}&(
  |{readonly kind:'inject';readonly prompts:readonly AuthorPromptInjectionV1[];readonly once:boolean}
  |{readonly kind:'remove';readonly ids:readonly string[]})
export interface BrowserGenerationInvocationV3 {
  readonly schemaVersion:1
  readonly encoding:'author-native-generation-invocation-v1'
  readonly invocationId:string
  readonly attemptId:string
  readonly binding:BrowserBindingV1
  readonly registrations:readonly BrowserCallbackRegistrationV3[]
  readonly capture:PromptCaptureV1
  readonly snapshot:AuthorNativeHelperSnapshotV1
}
export interface BrowserGenerationOutputV3 {
  readonly schemaVersion:1
  readonly encoding:'author-native-generation-output-v1'
  readonly authority:'consumer-data-only'
  readonly invocationId:string
  readonly programSha256:string
  readonly captureSha256:string
  readonly effects:readonly BrowserEffectV3[]
  readonly callbacksExecuted:number
  readonly outputSha256:string
}
export type BrowserGenerationResultV3={
  readonly kind:'executed'
  readonly binding:BrowserBindingV1
  readonly invocationId:string
  readonly result:AuthorNativeHelperGenerationResultV1
}|{
  readonly kind:'refused'|'cancelled'
  readonly binding:BrowserBindingV1
  readonly invocationId:string
  readonly diagnostics:readonly PromptDiagnosticV1[]
}
export type AuthorBrowserPreparationFacts=AuthorBrowserPreparationFactsV3
export type BrowserCallbackRegistration=BrowserCallbackRegistrationV3
export type BrowserGenerationInvocation=BrowserGenerationInvocationV3
export type BrowserGenerationOutput=BrowserGenerationOutputV3
export type BrowserGenerationResult=BrowserGenerationResultV3
/** The long-poll carries either real preparation or real MVU work. MVU output
 * never becomes a generation receipt or a schema-worker step. */
export interface BrowserMvuHookInvocation {
  readonly schemaVersion:1
  readonly encoding:'author-native-mvu-hook-invocation-v1'
  readonly invocationId:string
  readonly binding:BrowserBindingV1
  readonly request:AuthorNativeMvuHookRequest
  readonly registrations:readonly BrowserCallbackRegistration[]
}
export interface BrowserFilterInvocation extends AuthorNativeFilterInvocationV1 {
  readonly schemaVersion:1;readonly encoding:'author-native-injection-filter-invocation-v1'
  readonly invocationId:string;readonly binding:BrowserBindingV1
}
export interface BrowserFilterRetired {
  readonly encoding:'author-native-injection-filter-retired-v1';readonly realmId:string
  readonly resource:BrowserPromptResourceV3;readonly ids:readonly string[]
}
export type BrowserFilterCompletion={readonly binding:BrowserBindingV1;readonly invocationId:string;readonly operationId:string}&(
  {readonly kind:'executed';readonly accepted:boolean}|{readonly kind:'refused';readonly code:string})
export type BrowserAuthorInvocation=BrowserGenerationInvocation|BrowserMvuHookInvocation|BrowserFilterInvocation|BrowserFilterRetired
export type BrowserMvuHookCompletion={readonly binding:BrowserBindingV1;readonly invocationId:string}&(
  |{readonly kind:'executed';readonly callbackIds:readonly string[];readonly result:AuthorNativeMvuHookResult}
  |{readonly kind:'refused';readonly code:string})
export type BrowserPreparedMvuHookIdentity=AuthorNativeMvuHookIdentity
