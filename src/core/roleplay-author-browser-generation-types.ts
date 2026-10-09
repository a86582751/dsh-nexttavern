/** Live Browser generation DATA shares the actual Core preparation capture.
 * Its binding and receipts locate an invocation; the pending Core owner, not
 * these records, decides whether its result may enter the injection registry. */
import type {BrowserBindingV1} from './tavern-author-browser-types.mjs'
import type {BrowserSnapshotV2,BrowserProgramV2} from './tavern-author-browser-types-v2.mjs'
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
