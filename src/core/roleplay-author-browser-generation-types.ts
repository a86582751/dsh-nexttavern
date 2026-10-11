/** Live Browser generation DATA shares the actual Core preparation capture.
 * Its binding and receipts locate an invocation; the pending Core owner, not
 * these records, decides whether its result may enter the injection registry. */
import type {BrowserBindingV1} from './tavern-author-browser-types.mjs'
import type {BrowserSnapshotV2,BrowserProgramV2} from './tavern-author-browser-types-v2.mjs'
import type {BrowserSnapshotV3,BrowserProgramV3,BrowserWriterOriginV3} from './tavern-author-browser-types-v3.mjs'
import type {AuthorInjectionResourceV1} from 'dsh-nexttavern-session-format/author-injection-cleanup'
import type {AuthorPromptOpeningFactsV1} from './roleplay-author-prompt-capture.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'

export interface AuthorBrowserPreparationFactsV2 {
  readonly program:BrowserProgramV2
  readonly opening:AuthorPromptOpeningFactsV1
  readonly scopes:MvuScopeReadFrameV1
  readonly basis:Pick<BrowserSnapshotV2['basis'],'materialSha256'|'numericalSnapshotSha256'>
  readonly numerical:BrowserSnapshotV2['numerical']
  readonly persona:BrowserSnapshotV2['persona']
  readonly authorChat:BrowserSnapshotV2['authorChat']
}
import type {AuthorPromptInjectionV1,PromptCaptureV1,PromptDiagnosticV1,
  PromptEffectOriginV1} from './tavern-author-prompt-types.mjs'

export interface BrowserCallbackRegistrationV2 extends PromptEffectOriginV1 {
  readonly callbackId:string
  readonly priority:'first'|'normal'
  readonly registrationOrder:number
}

/** Injection payloads have the same host meaning for each producer. Browser
 * provenance remains separate from the stateless Prompt1 execution receipt. */
export type BrowserEffectV2=PromptEffectOriginV1&{readonly callbackId:string}&(
  |{readonly kind:'inject';readonly prompts:readonly AuthorPromptInjectionV1[];readonly once:boolean}
  |{readonly kind:'remove';readonly ids:readonly string[]})

export interface BrowserGenerationInvocationV2 {
  readonly schemaVersion:2
  readonly encoding:'native-author-browser-generation-invocation-v2'
  readonly invocationId:string
  readonly attemptId:string
  readonly binding:BrowserBindingV1
  readonly registrations:readonly BrowserCallbackRegistrationV2[]
  /** Both projections originate in one InputState capture. The Worker uses
   * these frozen reads while executing its existing UI callback closures. */
  readonly capture:PromptCaptureV1
  readonly snapshot:BrowserSnapshotV2
}

export interface BrowserGenerationOutputV2 {
  readonly schemaVersion:2
  readonly encoding:'native-author-browser-generation-output-v2'
  readonly authority:'consumer-data-only'
  readonly invocationId:string
  readonly programSha256:string
  readonly captureSha256:string
  readonly effects:readonly BrowserEffectV2[]
  readonly cleanupRemovals:readonly (PromptEffectOriginV1&{readonly ids:readonly string[]})[]
  readonly callbacksExecuted:number
  readonly outputSha256:string
}

export type BrowserGenerationResultV2={
  readonly kind:'executed'
  readonly binding:BrowserBindingV1
  readonly invocationId:string
  readonly output:BrowserGenerationOutputV2
}|{
  readonly kind:'refused'|'cancelled'
  readonly binding:BrowserBindingV1
  readonly invocationId:string
  readonly diagnostics:readonly PromptDiagnosticV1[]
}

/** One Main capture includes every declared ordinary key. These values are
 * readonly callback input; only the author's callback produces injection text. */
export interface AuthorBrowserPreparationFactsV3 extends Omit<AuthorBrowserPreparationFactsV2,
  'program'|'authorChat'> {
  readonly program:BrowserProgramV3
  readonly authorChats:BrowserSnapshotV3['authorChats']
}
/** Array order is the guest registry's actual order, including eventMakeFirst.
 * The origin identifies the registration's admitted Source unit, not an
 * arbitrary callback function's lexical birthplace. */
export interface BrowserCallbackRegistrationV3 extends BrowserWriterOriginV3 {
  readonly callbackId:string
  readonly resource:BrowserPromptResourceV3
}
export interface BrowserPromptResourceV3 extends AuthorInjectionResourceV1 {
  readonly pageId:string
}
export type BrowserPromptCleanupRequestV3={readonly resource:BrowserPromptResourceV3}&(
  |{readonly kind:'remove-ids';readonly ids:readonly string[]}
  |{readonly kind:'resource-closed'})
export type BrowserEffectV3=BrowserWriterOriginV3&{
  readonly callbackId:string;readonly resource:BrowserPromptResourceV3
}&(
  |{readonly kind:'inject';readonly prompts:readonly AuthorPromptInjectionV1[];readonly once:boolean}
  |{readonly kind:'remove';readonly ids:readonly string[]})
export interface BrowserGenerationInvocationV3 extends Omit<BrowserGenerationInvocationV2,
  'schemaVersion'|'encoding'|'registrations'|'snapshot'> {
  readonly schemaVersion:3
  readonly encoding:'native-author-browser-generation-invocation-v3'
  readonly registrations:readonly BrowserCallbackRegistrationV3[]
  readonly snapshot:BrowserSnapshotV3
}
export interface BrowserGenerationOutputV3 extends Omit<BrowserGenerationOutputV2,
  'schemaVersion'|'encoding'|'effects'|'cleanupRemovals'> {
  readonly schemaVersion:3
  readonly encoding:'native-author-browser-generation-output-v3'
  readonly effects:readonly BrowserEffectV3[]
  readonly cleanupRemovals:readonly (BrowserWriterOriginV3&{readonly ids:readonly string[]})[]
}
export type BrowserGenerationResultV3={
  readonly kind:'executed'
  readonly binding:BrowserBindingV1
  readonly invocationId:string
  readonly output:BrowserGenerationOutputV3
}|{
  readonly kind:'refused'|'cancelled'
  readonly binding:BrowserBindingV1
  readonly invocationId:string
  readonly diagnostics:readonly PromptDiagnosticV1[]
}
export type AuthorBrowserPreparationFacts=AuthorBrowserPreparationFactsV2|AuthorBrowserPreparationFactsV3
export type BrowserCallbackRegistration=BrowserCallbackRegistrationV2|BrowserCallbackRegistrationV3
export type BrowserGenerationInvocation=BrowserGenerationInvocationV2|BrowserGenerationInvocationV3
export type BrowserGenerationOutput=BrowserGenerationOutputV2|BrowserGenerationOutputV3
export type BrowserGenerationResult=BrowserGenerationResultV2|BrowserGenerationResultV3
