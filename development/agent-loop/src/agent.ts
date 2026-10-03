/**
 * Default Agent driver over queued turns and step-boundary input. Every request
 * is derived from the session log.
 * @module dsh-agent-loop/agent
 */

import type {
  Agent,
  AgentCancelCause,
  AgentEventDispatch,
  AgentOptions,
  AgentStatus,
  CancelOptions,
  InboxTarget,
  PreStepDecision,
  RequestErrorAction,
} from '@deepseek-ai/dsh-agent'
import { agentEvents, assembleContextFor } from '@deepseek-ai/dsh-agent'
import type { AssistantMessage, GenerateOptions, LlmCallConfig, Message, PreparedLlmCall } from '@deepseek-ai/dsh-llm'
import {
  LlmError,
  IMAGE_OFFLOAD_REQUIRED_CODE,
  createAssistantMessage,
  createDeveloperMessage,
  errorChain,
  freezeMessage,
  markAgentLoopRequest,
} from '@deepseek-ai/dsh-llm'
import { assertNever, deepFreeze } from '@deepseek-ai/dsh-util-values'
import { brandString } from '@deepseek-ai/dsh-brand'
import {inspectProgrammaticCommit, programmaticTurnIdentity} from './programmatic-commit.js'
import type {ProgrammaticCommitInput, ProgrammaticAssistantRejectionCode} from './programmatic-commit.js'
import type { Scope } from '@deepseek-ai/dsh-scope'
import { createScope } from '@deepseek-ai/dsh-scope'
import type { EpochHeader, RequestContext, Session, SessionEvent, SessionId, SessionSeq, TurnEndReason, UserMessage,
  NativeOpeningIdentityV1,NativeOpeningEventRefV1,NativeGeneratedOpeningReceiptV1 } from '@deepseek-ai/dsh-session'
import { canonicalHeader, headerEquals } from '@deepseek-ai/dsh-session'
import { joinContextSections, renderContextSections, renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import type { PromptAssembly } from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-session-projection'
import type { Context } from '@deepseek-ai/cordis'
import { ReactLoopInbox } from './inbox.js'
import {randomUUID} from 'node:crypto'
import type {NativeInputResumeProof} from './inbox.js'
import {INPUT_ADMISSION_ABORT_REASON, nativeInputLink, nativeInputSha256, nativeInputWorkSha256,
  nativePreparationReceipt, inspectNativeInboxHistory, nativeInputStopAcknowledgement} from './input-admission.js'
import type {NativeDurableInputWorkLookup, NativeDurableInputWorkReceiptV1, NativeDurableInputWorkSelector,
  NativeExistingInputWork, NativeExistingInputWorkV2, NativeInputAdmissionAgentV2, NativeInputAdmissionHook,
  NativeInputAdmissionHookV2, NativeInputAdmissionCheckV2, NativeInputBlocked, NativeInputClaim, NativeInputLinkV1,
  NativeInputOwnership, NativeInputProposal, NativeInputRef, NativeInputWakeResult, NativePreparationReceiptV1,
  NativeInputStopNoticeV1, NativeInputStopLookupV1, NativeOwnedContinuationControlV1,
  NativeInputSupplementV1, NativeInputCompletionLookupV1} from './input-admission.js'
import {nativeCompletedInputReceipt, nativeCompletedInputAcknowledgement} from './input-completion.js'
import { RuntimeContextProjection } from './runtime-context.js'
import { AssistantStreamAttempt } from './assistant-stream.js'
import { SystemPromptProjection } from './runtime-context.js'
import { executeToolCalls } from './tool-calls.js'
import {nativeRequestMaterialDecisionV1,nativeRequestMaterialOwnerRegistrationV1,
  nativeRequestMaterialOwnerCheckV1,nativeRequestMaterialPrepareDecisionV1,applyNativeOwnedSectionsV1,
  resolveNativeOwnedMaterialAnchorsV1,nativeOpeningMaterialOwnerRegistrationV1,
  nativeOpeningClosingAcknowledgementV1} from './request-material-owner.js'
import type {NativeRequestMaterialOwnerV1,NativeRequestMaterialInputV1,NativeRequestMaterialTransformV1,
  NativeMaterialSelectedBaseV1,NativeRequestMaterialPrepareInputV1,NativeMaterialSelectionEvidenceV1,
  NativeMaterialSelectionEventV1,NativeOpeningMaterialOwnerV1,NativeOpeningMaterialPrepareInputV1,
  NativeOpeningMaterialInputV1,NativeOpeningOwnerIdentityV1,NativeOpeningMaterialCheckV1} from './request-material-owner.js'
import {sealNativeOpeningRecordV1,nativeOpeningInstructionSha256V1,validateNativeOpeningInvocationV1,
  validateNativeOpeningRequestAttemptV1,validateNativeOpeningClosingAckV1} from './opening-record-hashes.js'
import {inspectNativeOpeningGenerationV1,openingEventRefV1,hasUnclosedNativeOpeningV1} from './opening-generation.js'
import type {NativeOpeningGenerationInspectionV1} from './opening-generation.js'
import {planNativeRequestEnvelope} from './request-envelope.js'
import {planNativeRequestMaterialV1} from './request-material.js'
import {bindNativeRequestMaterial} from './request-material-sidecar.js'
import type {SessionRequestAppendInput,SessionRequestBoundary} from '@deepseek-ai/dsh-session'

type Phase =
  | { kind: 'idle'; lastTurn: number }
  | {
    kind: 'maintenance'
    abort: AbortController
    lastTurn: number
    wakeRequested: boolean
  }
  | { kind: 'running'; abort: AbortController; turn: number; step: number; wakeRequested: boolean;
    programmatic?: {operationId: string; messageId: string; instruction: string;opening?:OpeningWork} }

type StepEndReason = Extract<TurnEndReason, { kind: 'completed' | 'max-tokens' }>

/** A caller-owned, stable identity for an assistant turn with no model request. */
export interface ProgrammaticAssistantCommit extends ProgrammaticCommitInput {}

/** A code explains an admission refusal or an existing partial turn; it never proves durability. */
export type {ProgrammaticAssistantRejectionCode} from './programmatic-commit.js'

export type ProgrammaticAssistantCommitResult =
  | { kind: 'committed'; turn: number; messageId: string }
  | { kind: 'unknown'; reason: string; code?: ProgrammaticAssistantRejectionCode }
  | { kind: 'busy' }

export type ProgrammaticAssistantLookupResult =
  | {status:'committed';turn:number} | {status:'absent'}
  | {status:'unknown';code?:ProgrammaticAssistantRejectionCode}

export interface ProgrammaticAssistantGeneration {
  operationId: string
  messageId: string
  instruction: string
  /** Opt-in to the independent actual Native opening owner. Absence retains
   * the existing programmatic generation path and its original result shape. */
  opening?:{readonly schemaVersion:1;readonly kind:'programmatic-opening';
    readonly intentRef:{readonly key:string;readonly sha256:string}}
}

export type ProgrammaticAssistantGenerationResult = ProgrammaticAssistantCommitResult
  |{readonly kind:'committed';readonly turn:number;readonly messageId:string;
    readonly generatedReceiptRef:NativeOpeningEventRefV1;readonly receipt:NativeGeneratedOpeningReceiptV1}
export interface NativeProgrammaticOpeningAgentV1 {
  readonly id:SessionId
  readonly session:Session
  readonly nativeProgrammaticOpeningVersion:1
  registerOpeningMaterialOwner(owner:NativeOpeningMaterialOwnerV1):()=>void
  generateProgrammaticAssistant(input:ProgrammaticAssistantGeneration):Promise<ProgrammaticAssistantGenerationResult>
  lookupProgrammaticOpening(input:ProgrammaticAssistantGeneration):NativeOpeningGenerationInspectionV1
  openingCompletion():{readonly status:'none'|'pending'|'blocked'|'unknown'|'settled';readonly code?:string;
    readonly invocationRef?:NativeOpeningEventRefV1;readonly generatedReceiptRef?:NativeOpeningEventRefV1}
}

type PreparedStep =
  | { kind: 'reject' }
  | {
    kind: 'enter'
    messages: UserMessage[]
    startsRequestSeries?: true
    assembly: PromptAssembly
    admission?: InputAdmission
  }
type OwnedContinuation = {ref: NativeInputRef; ownerToken: object; parentSha256: string; turn: number; claimed: boolean}
type AdmissionRegistration = {hook: NativeInputAdmissionHook | NativeInputAdmissionHookV2; active: boolean;
  requestMaterial?:NativeRequestMaterialOwnerV1;
  stopOwner?: NativeInputAdmissionHookV2['onStop']; nominations?: Map<string, OwnedContinuation>; usedTokens?: WeakSet<object>}
type InputAdmission = {registration: AdmissionRegistration; proposal: NativeInputProposal; identity: unknown;
  resumeProof?: NativeInputResumeProof; claim?: NativeInputClaim; continuation?: true;
  preparation?: NativePreparationReceiptV1; marker?: NativeInputLinkV1; startSeq?: number;
  receipt?: NativeDurableInputWorkReceiptV1; supplement?: NativeInputSupplementV1; ownedContinuations?: true;
  completedWorkRequired?: true}
type InputAdmissionOutcome = {kind: 'admitted'; admission: InputAdmission} | {kind: 'none'} | {kind: 'blocked'}
type InputStopState = {notice: NativeInputStopNoticeV1; result: NativeInputStopLookupV1; done: Promise<void>}
type InputStopWork = {registration: AdmissionRegistration; refs: readonly NativeInputRef[];
  preparation?: NativePreparationReceiptV1; receipt?: NativeDurableInputWorkReceiptV1; ownedContinuations?: true}
type InputCompletionState = {registration: AdmissionRegistration;
  result: Exclude<NativeInputCompletionLookupV1, {status: 'none'}>}
const nativeAdmissionAgents = new WeakSet<object>()
const openingSelectionAppendTypes=new Set<SessionEvent['type']>(['step/start','system/message','developer/message',
  'request/header','request/context','request/material','assistant/attempt','opening/request-attempt'])
type OpeningRegistration={readonly owner:NativeOpeningMaterialOwnerV1;active:boolean}
type OpeningWork={readonly registration:OpeningRegistration;readonly identity:NativeOpeningIdentityV1;
  readonly invocation:SessionEvent<'opening/invocation'>;readonly attempts:Map<number,number>}
type OpeningCompletion={status:'pending'|'blocked'|'unknown'|'settled';code?:string;
  invocationRef?:NativeOpeningEventRefV1;generatedReceiptRef?:NativeOpeningEventRefV1}
type MaterialRequestOwner={readonly kind:'player-input';readonly admission:InputAdmission;readonly owner:NativeRequestMaterialOwnerV1}
  |{readonly kind:'programmatic-opening';readonly opening:OpeningWork;readonly owner:NativeOpeningMaterialOwnerV1}

type MaterialSelectionCut={readonly boundary:SessionRequestBoundary;readonly sha256:string}
type MaterialSelectionLineage={
  readonly session:Session;readonly phase:Extract<Phase,{kind:'running'}>;readonly turn:number;readonly step:number;
  readonly initial:NativeMaterialSelectedBaseV1;readonly pending:readonly NativeMaterialSelectedBaseV1['messages'][number][];
  readonly assertCurrent:()=>void;readonly events:NativeMaterialSelectionEventV1[];readonly actualEvents:SessionEvent[];
  expected:MaterialSelectionCut;active:boolean;revision:number;pendingCursor:number;attemptStarted:boolean;
  stepStartSeq?:number;checkpointSha256?:string;
  lastAttempt?:{readonly event:SessionEvent<'assistant/attempt'>;readonly sha256:string};
}&({readonly kind:'player-input';readonly admission:InputAdmission;readonly registration:AdmissionRegistration;
  readonly identity:unknown;readonly owner:NativeRequestMaterialOwnerV1;readonly claim:NativeInputClaim;readonly claimSha256:string}
  |{readonly kind:'programmatic-opening';readonly opening:OpeningWork;readonly registration:OpeningRegistration;
    readonly owner:NativeOpeningMaterialOwnerV1})
type MaterialSelectedProvenance={readonly lineage:MaterialSelectionLineage;readonly revision:number;
  readonly pendingCursor:number;readonly boundarySha256:string}
type MaterialRecoveryCut={readonly lineage:MaterialSelectionLineage;readonly before:MaterialSelectionCut;
  readonly events:readonly SessionEvent[];readonly failureSha256:string;readonly offloadImages?:number;
  readonly targets?:readonly {readonly seq:number;readonly imageIndexes:readonly number[]}[]}
const nativeMaterialSelections=new WeakMap<NativeMaterialSelectedBaseV1,MaterialSelectedProvenance>()

/** Only exact objects created by the live Agent's prepared lineage are
 * accepted. The current object expires at the next boundary; copied data and
 * returned evidence can never register a selected cut or grant dispatch. */
export function assertNativeRequestMaterialSelectionV1(initial:NativeMaterialSelectedBaseV1,
  current:NativeMaterialSelectedBaseV1):NativeMaterialSelectionEvidenceV1 {
  const root=nativeMaterialSelections.get(initial),selected=nativeMaterialSelections.get(current)
  if(!root||!selected||root.lineage!==selected.lineage||root.lineage.initial!==initial){
    throw Error('REQUEST_MATERIAL_SELECTION_NOT_NATIVE')
  }
  const lineage=root.lineage
  lineage.assertCurrent()
  if(selected.revision!==lineage.revision||selected.pendingCursor!==lineage.pendingCursor
    ||selected.boundarySha256!==lineage.expected.sha256){
    throw Error('REQUEST_MATERIAL_SELECTION_CUT_EXPIRED')
  }
  return Object.freeze({schemaVersion:1 as const,encoding:'native-request-material-selection-lineage-v1' as const,
    sessionId:String(lineage.session.id),turn:lineage.turn,step:lineage.step,
    initialSha256:initial.sha256,currentSha256:current.sha256,
    boundarySeq:Number(lineage.expected.boundary.boundarySeq),
    contentGeneration:lineage.expected.boundary.contentGeneration,
    pendingMessages:lineage.pending.length-lineage.pendingCursor,revision:lineage.revision,
    ...lineage.checkpointSha256?{checkpointSha256:lineage.checkpointSha256}:{},
    events:Object.freeze([...lineage.events])})
}

/** Actual constructor identity, not a caller-supplied capability/verified flag. */
export function nativeInputAdmissionCapability(agent: unknown): NativeInputAdmissionAgentV2 | undefined {
  return agent instanceof ReactLoopAgent && nativeAdmissionAgents.has(agent) ? agent : undefined
}
export function nativeProgrammaticOpeningCapability(agent:unknown):NativeProgrammaticOpeningAgentV1|undefined {
  return agent instanceof ReactLoopAgent&&nativeAdmissionAgents.has(agent)?agent:undefined
}

/** Remove adapter-derived values before plugins propose the next request config. */
function requestProposal(header: EpochHeader): LlmCallConfig {
  if (header.adapterDefaults === undefined) return header.config
  const proposal = { ...header.config }
  if (header.adapterDefaults.reasoningEffort === true) delete proposal.reasoningEffort
  if (header.adapterDefaults.maxTokens === true) delete proposal.maxTokens
  return proposal
}

/**
 * Read the cause `cancel()` passed when aborting a loop-owned signal, copying
 * only the fields `turn/end` records. The live reason stays the caller's
 * object, and Node's fetch assigns a `stack` onto it that `Session.append`
 * would either log or reject as data JSON cannot hold.
 * @param signal - a turn or maintenance signal this loop owns.
 * @returns the copied cause, or undefined while the signal is still live.
 */
function abortedCancelCause(signal: AbortSignal): AgentCancelCause | undefined {
  if (!signal.aborted) return undefined
  // `cancel()` is the only aborter of the signals this loop owns.
  const cause = signal.reason as AgentCancelCause
  switch (cause.kind) {
    case 'user':
    case 'parent':
    case 'disposed':
      return { kind: cause.kind }
    case 'hook':
      return { kind: 'hook', reason: cause.reason }
    /* v8 ignore next -- cancel accepts the closed AgentCancelCause union */
    default:
      return assertNever(cause)
  }
}

/** Drives one session through turn and step boundaries. */
export class ReactLoopAgent implements Agent {
  readonly inbox: ReactLoopInbox
  private phase: Phase
  private activityDone: Promise<void> = Promise.resolve()

  /** The agent-scoped registration boundary; the lifecycle owner unwinds it after the driver exits. */
  readonly scope: Scope
  readonly ctx: Context

  /** Fused dispatcher, built once in the constructor so hot-path dispatches never allocate. */
  private readonly dispatch: AgentEventDispatch

  /** Whether this loop instance has appended its initial/resume request anchor. */
  private requestHeaderLogged = false
  /** Surface generation at attachment or the preceding built request. */
  private requestSurfaceGeneration: number
  private readonly runtimeContext: RuntimeContextProjection
  /** Process-local revision of assistant frames for this attached Session. */
  private assistantStreamRevision = 0
  private assistantAttemptCounter = 0
  private readonly systemPrompt: SystemPromptProjection
  /** Identities fully frozen by this loop; weak references do not retain replaced history. */
  private readonly frozenMessages = new WeakSet<Message>()
  /** A failed append before the message boundary cannot be assigned a safe retry turn in this live session. */
  private readonly uncertainProgrammaticOperations = new Set<string>()
  /** An unclosed append-only turn forbids another driver from writing behind it. */
  private programmaticTurnPoisoned = false
  private inputAdmission?: AdmissionRegistration
  /** JS-private issuer state; no exported registration seam exists. It is
   * retired at step exit and never reconstructed from serialized evidence. */
  #materialSelection?:MaterialSelectionLineage
  private existingInputWork?: NativeExistingInputWork & {receipt?: NativeDurableInputWorkReceiptV1}
  private inputAdmissionBlocked?: {registration: AdmissionRegistration; notice: NativeInputBlocked}
  private inputWakeStopped = false
  private inputDisposed = false
  private inputOnlyWakeLatched = false
  private inputStopSequence = 0
  private inputStop?: InputStopState
  /** Retain the last owner work across a blocked driver becoming idle. */
  private inputStopWork?: InputStopWork
  /** Independent terminal gate. An ordinary wake or acknowledged cancellation
   * cannot turn an uncertain post-close Source write into replay permission. */
  private inputCompletion?: InputCompletionState
  private openingMaterial?:OpeningRegistration
  private openingRecovery?:OpeningWork
  private openingDomainCompletion?:OpeningCompletion
  private get openingCompletionBlocked():boolean {
    return this.openingDomainCompletion!==undefined&&this.openingDomainCompletion.status!=='settled'
  }
  private get inputCompletionBlocked(): boolean {
    return this.inputCompletion !== undefined && this.inputCompletion.result.status !== 'settled'
  }

  constructor(
    private loopCtx: Context,
    public readonly id: SessionId,
    public readonly options: AgentOptions,
    public readonly session: Session,
  ) {
    this.requestSurfaceGeneration = session.surface.contentGeneration
    this.dispatch = agentEvents(loopCtx, this)
    this.scope = createScope(loopCtx, this)
    this.ctx = this.scope.ctx
    this.inbox = new ReactLoopInbox(this.ctx.sessionProjections, session, this.dispatch)
    /* v8 ignore next -- the loop registers its own turnBoundary unit, so the key is always present */
    const lastTurn = this.loopCtx.sessionProjections.stateOf(session, 'turnBoundary')?.lastTurn ?? 0
    this.phase = { kind: 'idle', lastTurn }
    this.runtimeContext = new RuntimeContextProjection(this.ctx, session)
    this.systemPrompt = new SystemPromptProjection(session)
    nativeAdmissionAgents.add(this)
    if(hasUnclosedNativeOpeningV1(session,this.ctx.sessions.messageProjections))
      this.openingDomainCompletion={status:'unknown',code:'OPENING_COLD_RECOVERY_REQUIRED'}
  }

  get nativeInputAdmissionVersion(): 2 {return 2}
  get nativeRequestMaterialVersion():1 {return 1}
  get nativeInputStopVersion(): 1 {return 1}
  get nativeProgrammaticOpeningVersion():1 {return 1}
  registerOpeningMaterialOwner(owner:NativeOpeningMaterialOwnerV1):()=>void {
    if(this.inputDisposed||!nativeAdmissionAgents.has(this)||this.phase.kind!=='idle'||this.openingMaterial?.active)
      throw Error('OPENING_OWNER_REGISTRATION_BUSY_OR_DISPOSED')
    const registration:OpeningRegistration={owner:nativeOpeningMaterialOwnerRegistrationV1(owner),active:true}
    this.openingMaterial=registration
    return ()=>{
      if(!registration.active)return
      registration.active=false
      if(this.openingMaterial===registration)this.openingMaterial=undefined
      if(this.phase.kind==='running'&&this.phase.programmatic?.opening?.registration===registration) {
        this.openingDomainCompletion={status:'unknown',code:'OPENING_OWNER_REVOKED',
          invocationRef:openingEventRefV1(this.phase.programmatic.opening.invocation)}
        this.phase.abort.abort({kind:'hook',reason:'OPENING_OWNER_REVOKED'})
      }else if(this.phase.kind==='maintenance'&&this.openingRecovery?.registration===registration) {
        this.openingDomainCompletion={status:'unknown',code:'OPENING_OWNER_REVOKED',
          invocationRef:openingEventRefV1(this.openingRecovery.invocation)}
        this.phase.abort.abort({kind:'hook',reason:'OPENING_OWNER_REVOKED'})
      }
    }
  }
  openingCompletion():ReturnType<NativeProgrammaticOpeningAgentV1['openingCompletion']> {
    return Object.freeze(this.openingDomainCompletion?{...this.openingDomainCompletion}:{status:'none' as const})
  }
  private openingIdentity(input:ProgrammaticAssistantGeneration):NativeOpeningIdentityV1 {
    const opening=input.opening
    if(!opening||opening.schemaVersion!==1||opening.kind!=='programmatic-opening'
      ||Object.keys(opening).length!==3)throw Error('OPENING_GENERATION_OWNER_INPUT_INVALID')
    // The strict invocation parser also verifies complete identity and ref
    // shape before this detached object can reach a callback or Native append.
    return validateNativeOpeningInvocationV1(sealNativeOpeningRecordV1({schemaVersion:1 as const,
      encoding:'native-programmatic-opening-invocation-v1' as const,
      identity:{kind:'programmatic-opening' as const,sessionId:String(this.id),operationId:input.operationId,
        messageId:input.messageId,instruction:input.instruction,
        instructionSha256:nativeOpeningInstructionSha256V1(input.instruction),intentRef:opening.intentRef},
      expectedTurn:1,prefix:{eventCount:0,inheritedEventCount:0,sha256:nativeInputSha256([])}},'invocationSha256')).identity
  }
  lookupProgrammaticOpening(input:ProgrammaticAssistantGeneration):NativeOpeningGenerationInspectionV1 {
    return inspectNativeOpeningGenerationV1(this.session,this.openingIdentity(input),this.ctx.sessions.messageProjections)
  }

  get status(): AgentStatus {
    return this.phase.kind === 'idle' || this.phase.kind === 'maintenance' ? 'idle' : 'running'
  }

  get programmaticGeneration(): {operationId: string} | null {
    return this.phase.kind === 'running' && this.phase.programmatic
      ? {operationId: this.phase.programmatic.operationId} : null
  }

  /** Commit a phase and publish its externally visible status transition. */
  private setPhase(next: Phase): void {
    const previousStatus = this.status
    this.phase = next
    const status = this.status
    if (status !== previousStatus) {
      this.dispatch.emit('agent/status', { status })
    }
  }

  send(message: UserMessage, target: InboxTarget, wakeup: boolean): void {
    if (wakeup && !this.inputDisposed && (!this.inputStop || this.inputStop.result.status === 'acknowledged')) {
      if (this.inputStop && !this.inputCompletionBlocked) this.inputStopWork = undefined
      this.inputStop = undefined
      this.inputWakeStopped = false
      this.inputOnlyWakeLatched = false
    }
    // Waking input cannot join an aborted activity, so it starts the next turn.
    // Captured before the insertion so a reentrant cancel from a splice observer cannot reclassify it.
    const wakingAfterAbort = wakeup && this.phase.kind !== 'idle' && this.phase.abort.signal.aborted
    const resolvedTarget = wakingAfterAbort ? 'next-turn' : target
    this.inbox.splice(resolvedTarget, Infinity, 0, [message])
    if (wakeup) this.wakeDriver(wakingAfterAbort)
  }

  followup(input: UserMessage): void {
    this.send(input, 'next-turn', true)
  }

  steer(input: UserMessage): void {
    this.send(input, 'next-step', true)
  }

  inject(input: UserMessage): void {
    this.send(input, 'next-step', false)
  }

  cancel(cause: AgentCancelCause, options: CancelOptions = {}): void {
    if(this.phase.kind==='running'&&this.phase.programmatic?.opening) {
      this.openingDomainCompletion={status:'unknown',code:'OPENING_GENERATION_CANCELLED',
        invocationRef:openingEventRefV1(this.phase.programmatic.opening.invocation)}
    }else if(this.phase.kind==='maintenance'&&this.openingRecovery) {
      this.openingDomainCompletion={status:'unknown',code:'OPENING_GENERATION_CANCELLED',
        invocationRef:openingEventRefV1(this.openingRecovery.invocation)}
    }
    if (cause.kind === 'disposed') {
      this.inputDisposed = true
      nativeAdmissionAgents.delete(this)
    }
    if (cause.kind !== 'hook' || cause.reason !== INPUT_ADMISSION_ABORT_REASON) this.inputWakeStopped = true
    try {
      // Install the barrier before invoking user code: reentrant cancellation
      // sees the same generation, while disposal can supersede it safely.
      if (cause.kind !== 'hook' || cause.reason !== INPUT_ADMISSION_ABORT_REASON) this.notifyInputStop(cause, options)
    } finally {
      try {
        if (this.inputWakeStopped && this.inputOnlyWakeLatched) {
          if (this.phase.kind !== 'idle') this.phase.wakeRequested = false
          this.inputOnlyWakeLatched = false
          this.existingInputWork = undefined
        }
        if (!options.keepInbox) {
          this.inbox.clear()
          if (this.phase.kind !== 'idle') this.phase.wakeRequested = false
        }
      } finally {
        if (this.phase.kind !== 'idle') this.phase.abort.abort(cause)
      }
    }
  }

  private notifyInputStop(cause: AgentCancelCause, options: CancelOptions): void {
    const registration = this.inputAdmission
    const stopOwner = registration?.stopOwner
    if (!registration || !stopOwner) return
    if (this.inputStop && (cause.kind !== 'disposed' || this.inputStop.notice.cause.kind === 'disposed')) return
    const stopSequence = ++this.inputStopSequence
    let notice: NativeInputStopNoticeV1
    try {
      const selected = this.inputStopWork?.registration === registration ? this.inputStopWork : this.existingInputWork
      const work = selected ? {refs: selected.refs,
        preparation: nativePreparationReceipt(selected.preparation), receipt: selected.receipt} : undefined
      const refs = new Map<string, NativeInputRef>()
      for (const ref of work?.refs ?? []) refs.set(nativeInputSha256(ref), ref)
      // A splice observer can cancel after removal but before claimExact
      // returns. Retain nominated refs even during that synchronous boundary.
      for (const entry of registration.nominations?.values() ?? []) refs.set(nativeInputSha256(entry.ref), entry.ref)
      let refsCode: NativeInputStopNoticeV1['refsCode']
      const history = inspectNativeInboxHistory(this.session.id, this.session.snapshotEvents(), this.session.inheritedEventCount)
      for (const entry of [...history.pending['next-step'], ...history.pending['next-turn']]) {
        if (history.ownership(entry.ref).status !== 'pending') refsCode = 'INPUT_OWNERSHIP_UNKNOWN'
        refs.set(nativeInputSha256(entry.ref), entry.ref)
      }
      notice = deepFreeze({schemaVersion: 1, sessionId: this.session.id, stopSequence, stopNonce: randomUUID(),
        cause: {kind: cause.kind, ...(cause.kind === 'hook' ? {hookReasonSha256: nativeInputSha256(cause.reason)} : {})},
        keepInbox: options.keepInbox === true, phase: this.phase.kind, refs: [...refs.values()],
        ...(refsCode ? {refsCode} : {}), ...(work?.preparation ? {preparation: work.preparation} : {}),
        ...(work?.receipt ? {receipt: work.receipt} : {})})
    } catch {
      // Even unreadable history/metadata must notify the owner synchronously.
      // A minimal unknown notice cannot be acknowledged into readiness.
      notice = Object.freeze({schemaVersion: 1, sessionId: this.session.id, stopSequence,
        stopNonce: `unavailable-${stopSequence}`, cause: Object.freeze({kind: cause.kind}),
        keepInbox: options.keepInbox === true, phase: this.phase.kind, refs: Object.freeze([]), refsCode: 'INPUT_OWNERSHIP_UNKNOWN'})
    }
    const done = Promise.withResolvers<void>()
    const state: InputStopState = {notice, result: Object.freeze({status: 'pending', notice}), done: done.promise}
    this.inputStop = state
    const unknown = (code: string): void => {state.result = Object.freeze({status: 'unknown', notice, code}); done.resolve()}
    try {
      // Do not defer invocation into a Promise callback: owner revocation must
      // execute in cancel's synchronous stack, before native clear and abort.
      const acknowledgement = stopOwner(notice)
      void Promise.resolve(acknowledgement).then(value => {
        state.result = nativeInputStopAcknowledgement(value, notice)
        done.resolve()
      }, () => {unknown('INPUT_STOP_ACK_FAILED')})
    } catch {unknown('INPUT_STOP_ACK_FAILED')}
  }

  lookupInputStop(): NativeInputStopLookupV1 {return this.inputStop?.result ?? Object.freeze({status: 'none'})}
  lookupInputCompletion(): NativeInputCompletionLookupV1 {
    return this.inputCompletion?.result ?? Object.freeze({status: 'none'})
  }

  async whenInputStopSettled(): Promise<NativeInputStopLookupV1> {
    let state: InputStopState | undefined
    do {
      state = this.inputStop
      await state?.done
    } while (state !== this.inputStop)
    return this.lookupInputStop()
  }

  /** Consume late owner results without applying them after cancellation. The
   * stop ACK owns quiescence; awaiting this driver's idle here would deadlock. */
  private awaitInputOperation<T>(operation: Promise<T>, signal: AbortSignal, registration: AdmissionRegistration): Promise<T> {
    if (!registration.stopOwner) return operation
    return (async () => {
      const cancelled = Promise.withResolvers<never>()
      const onAbort = (): void => {cancelled.reject(signal.reason)}
      signal.addEventListener('abort', onAbort, {once: true})
      if (signal.aborted) onAbort()
      try {
        const result = await Promise.race([operation, cancelled.promise])
        if (signal.aborted) {await this.whenInputStopSettled(); signal.throwIfAborted()}
        return result
      } catch (error) {
        if (signal.aborted) {await this.whenInputStopSettled(); signal.throwIfAborted()}
        throw error
      } finally {signal.removeEventListener('abort', onAbort)}
    })()
  }

  /** One lifecycle owner; ordinary upstream callers keep the unregistered path. */
  registerInputAdmission(hook: NativeInputAdmissionHook | NativeInputAdmissionHookV2): () => void {
    if (this.inputDisposed || this.inputAdmission) throw Error('native input admission already owned or disposed')
    if (typeof hook.admit !== 'function' || typeof hook.check !== 'function') throw Error('invalid native input admission hook')
    if (hook.schemaVersion !== undefined && hook.schemaVersion !== 1 && hook.schemaVersion !== 2) throw Error('unsupported native input admission hook')
    if (hook.schemaVersion === 2 && typeof hook.checkpoint !== 'function') throw Error('v2 native input admission needs checkpoint')
    const ownsContinuations = hook.schemaVersion === 2
      && (hook.onContinuationControl !== undefined || hook.recognizeSupplement !== undefined)
    if (ownsContinuations && hook.schemaVersion === 2
      && (typeof hook.onContinuationControl !== 'function' || typeof hook.recognizeSupplement !== 'function')) {
      throw Error('native continuation hooks must be paired')
    }
    const stopOwner = hook.schemaVersion === 2 ? hook.onStop : undefined
    if (stopOwner !== undefined && typeof stopOwner !== 'function') throw Error('invalid native input stop hook')
    if (hook.schemaVersion === 2 && hook.completedWork !== undefined && typeof hook.completedWork !== 'function') {
      throw Error('invalid native completed input hook')
    }
    const requestMaterial=hook.schemaVersion===2&&hook.requestMaterial!==undefined
      ?nativeRequestMaterialOwnerRegistrationV1(hook.requestMaterial):undefined
    const registration: AdmissionRegistration = {hook, active: true,
      ...(requestMaterial?{requestMaterial}:{}),...(stopOwner ? {stopOwner: stopOwner.bind(hook)} : {}),
      ...(ownsContinuations ? {nominations: new Map(), usedTokens: new WeakSet()} : {})}
    this.inputAdmission = registration
    if (ownsContinuations && hook.schemaVersion === 2) {
      try {hook.onContinuationControl!({steerOwnedContinuation: (message, scope) =>
        this.insertOwnedContinuation(registration, message, scope)})}
      catch {
        registration.active = false
        this.inputAdmission = undefined
        throw Error('native continuation control registration failed')
      }
    }
    return () => {
      registration.active = false
      registration.nominations?.clear()
      if (this.inputAdmission === registration) this.inputAdmission = undefined
      this.existingInputWork = undefined
    }
  }

  /** Registration-private authority is hot and bounded to the original actual
   * checkpoint. Ordinary send/steer can wake or clear stops; this control cannot. */
  private insertOwnedContinuation(registration: AdmissionRegistration, message: UserMessage,
    scope: Parameters<NativeOwnedContinuationControlV1['steerOwnedContinuation']>[1]):
    ReturnType<NativeOwnedContinuationControlV1['steerOwnedContinuation']> {
    const ready = (): boolean => {
      const work = this.inputStopWork
      return !this.inputDisposed && !this.inputStop && !this.inputWakeStopped && !this.inputCompletionBlocked && registration.active
        && this.inputAdmission === registration && this.phase.kind === 'running' && !this.phase.programmatic
        && !this.phase.abort.signal.aborted && this.phase.step >= 1 && work?.registration === registration
        && work.ownedContinuations === true && !!work.receipt && work.receipt.actualTurn === this.phase.turn
        && nativeInputSha256(work.receipt) === nativeInputSha256(scope.parent)
    }
    try {
      if (!registration.nominations || !registration.usedTokens || !ready()
        || message.source?.kind === 'user' || !scope.ownerToken || typeof scope.ownerToken !== 'object') {
        return {kind: 'blocked', code: 'INPUT_CONTINUATION_SCOPE_INVALID'}
      }
      if (registration.usedTokens.has(scope.ownerToken)) return {kind: 'blocked', code: 'INPUT_CONTINUATION_TOKEN_USED'}
      // A failed or uncertain insert is not permission to replay this token.
      registration.usedTokens.add(scope.ownerToken)
      const parentSha256 = nativeInputSha256(scope.parent), turn = scope.parent.actualTurn
      let insertedRef: NativeInputRef | undefined
      try {
        this.inbox.insertTrackedNextStep(message, ref => {
          insertedRef = ref
          registration.nominations!.set(nativeInputSha256(ref), {ref, ownerToken: scope.ownerToken,
            parentSha256, turn, claimed: false})
        })
      } catch {
        return {kind: 'blocked', code: 'INPUT_CONTINUATION_INSERT_UNKNOWN', ...(insertedRef ? {insertedRef} : {})}
      }
      if (!insertedRef || !ready()) {
        return {kind: 'blocked', code: 'INPUT_CONTINUATION_REVOKED', ...(insertedRef ? {insertedRef} : {})}
      }
      return {kind: 'inserted', ref: insertedRef}
    } catch {return {kind: 'blocked', code: 'INPUT_CONTINUATION_SCOPE_INVALID'}}
  }

  lookupInputOwnership(ref: NativeInputRef): NativeInputOwnership {return this.inbox.lookupOwnership(ref)}
  lookupDurableInputWork(selector: NativeDurableInputWorkSelector): NativeDurableInputWorkLookup {
    return this.inbox.lookupDurableWork(selector)
  }

  /** Wake only work already owned by this inbox, never send or insert a message. */
  wakePending(): NativeInputWakeResult {
    if (this.inputDisposed) return {kind: 'disposed'}
    if (this.inputStop || this.inputWakeStopped || this.programmaticTurnPoisoned || this.inputCompletionBlocked) return {kind: 'blocked'}
    if (!this.inbox.hasPending) return {kind: 'empty'}
    if (this.phase.kind === 'running') return {kind: 'running'}
    const latched = this.phase.kind === 'maintenance'
    this.inputOnlyWakeLatched = latched
    this.wakeDriver()
    return {kind: latched ? 'latched' : 'started'}
  }

  /** Owner credentials supplement native history; no caller body is accepted. */
  wakeExistingWork(work: NativeExistingInputWork | NativeExistingInputWorkV2): NativeInputWakeResult {
    if (this.inputDisposed) return {kind: 'disposed'}
    if (this.inputStop || this.inputWakeStopped || this.inputCompletionBlocked || !this.inputAdmission || work?.preparation == null
      || !Array.isArray(work.refs)) return {kind: 'blocked'}
    let selected: NativeExistingInputWork & {receipt?: NativeDurableInputWorkReceiptV1}
    try {
      if (this.inputAdmission.hook.schemaVersion === 2) {
        const preparation = nativePreparationReceipt(work.preparation)
        const receipt = 'receipt' in work ? work.receipt : undefined
        if (!preparation || !receipt || nativeInputSha256(preparation) !== nativeInputSha256(receipt.preparation)
          || nativeInputSha256(work.refs) !== nativeInputSha256(receipt.refs) || !this.inbox.canResumeLinked(receipt)) return {kind: 'blocked'}
        selected = {preparation, refs: deepFreeze(structuredClone(work.refs)), receipt: deepFreeze(structuredClone(receipt))}
      } else {
        if (!this.inbox.canResume(work.refs)) return {kind: 'blocked'}
        selected = {preparation: work.preparation, refs: deepFreeze(structuredClone(work.refs))}
      }
    } catch {return {kind: 'blocked'}}
    if (this.phase.kind === 'running' || this.existingInputWork) return {kind: 'running'}
    this.existingInputWork = selected
    const latched = this.phase.kind === 'maintenance'
    this.inputOnlyWakeLatched = latched
    this.wakeDriver()
    return {kind: latched ? 'latched' : 'started'}
  }

  private blockInput(registration: AdmissionRegistration, code: string, stage: NativeInputBlocked['stage'],
    proposal: NativeInputProposal, partialClaim?: NativeInputClaim, refs = partialClaim?.refs ?? proposal.refs): void {
    const thinCode = typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code) ? code : 'INPUT_ADMISSION_BLOCKED'
    this.inputAdmissionBlocked = {registration, notice: {code: thinCode, stage, refs,
      ...(partialClaim ? {partialClaim: {turn: partialClaim.turn, refs: partialClaim.refs,
        spliceSeqs: partialClaim.spliceSeqs, resumed: partialClaim.resumed}} : {})}}
  }

  private async admitInput(target: InboxTarget): Promise<InputAdmissionOutcome> {
    const registration = this.inputAdmission
    if (!registration || this.phase.kind !== 'running' || this.phase.programmatic) return {kind: 'none'}
    const signal = this.phase.abort.signal
    const existing = this.existingInputWork
    let proposal: NativeInputProposal
    try {proposal = this.inbox.propose(target)} catch {
      this.inputAdmissionBlocked = {registration, notice: {code: 'INPUT_OWNERSHIP_UNKNOWN', stage: 'proposal', refs: existing?.refs ?? []}}
      return {kind: 'blocked'}
    }
    const refused = (code: string): InputAdmissionOutcome => {
      this.blockInput(registration, code, 'proposal', proposal, undefined, existing?.refs)
      return {kind: 'blocked'}
    }
    if (!proposal.messages.length && !existing) {
      return target === 'next-step' ? {kind: 'none'} : refused('INPUT_EMPTY')
    }
    const hook = registration.hook
    this.inputStopWork = {registration, refs: existing?.refs ?? proposal.refs,
      ...(existing?.receipt ? {preparation: existing.receipt.preparation, receipt: existing.receipt} : {})}
    let decision: Awaited<ReturnType<NativeInputAdmissionHook['admit']>> | Awaited<ReturnType<NativeInputAdmissionHookV2['admit']>>
    try {
      if (hook.schemaVersion === 2) {
        let linked: NativeExistingInputWorkV2 | undefined
        if (existing) {
          const preparation = nativePreparationReceipt(existing.preparation)
          if (!preparation || !existing.receipt) return refused('INPUT_RESUME_RECEIPT_MISSING')
          linked = {preparation, refs: existing.refs, receipt: existing.receipt}
        }
        decision = await this.awaitInputOperation(hook.admit(proposal, signal, linked), signal, registration)
      } else decision = await hook.admit(proposal, signal, existing)
    }
    catch {
      if (this.inputStop) await this.whenInputStopSettled()
      signal.throwIfAborted()
      return refused('INPUT_ADMISSION_HOOK_FAILED')
    }
    if (signal.aborted) await this.whenInputStopSettled()
    signal.throwIfAborted()
    if (!registration.active || this.inputAdmission !== registration || !this.inbox.matches(proposal)) return refused('INPUT_PROPOSAL_CHANGED')
    if (!decision || typeof decision !== 'object') return refused('INPUT_ADMISSION_DECISION_INVALID')
    if (decision.kind === 'blocked') return refused(decision.code)
    if (decision.kind !== 'allow' && decision.kind !== 'resume') return refused('INPUT_ADMISSION_DECISION_INVALID')
    if (hook.schemaVersion === 2 && decision.identity === undefined) return refused('INPUT_ADMISSION_IDENTITY_MISSING')
    let preparation: NativePreparationReceiptV1 | undefined
    if (hook.schemaVersion === 2) {
      try {preparation = nativePreparationReceipt(Object.getOwnPropertyDescriptor(decision, 'preparation')?.value)}
      catch {return refused('INPUT_PREPARATION_RECEIPT_INVALID')}
    }
    if (hook.schemaVersion === 2 && !preparation) return refused('INPUT_PREPARATION_RECEIPT_INVALID')
    const ownedContinuations = hook.schemaVersion === 2 && 'ownedContinuations' in decision
      && decision.ownedContinuations === true ? true as const : undefined
    if (ownedContinuations && !registration.nominations) return refused('INPUT_CONTINUATION_CONTROL_MISSING')
    const completedWorkRequired = hook.schemaVersion === 2 && 'completedWorkRequired' in decision
      && decision.completedWorkRequired === true ? true as const : undefined
    if (completedWorkRequired && (hook.schemaVersion !== 2 || !hook.completedWork || !registration.stopOwner)) {
      return refused('INPUT_COMPLETION_CONTROL_MISSING')
    }
    if (preparation) this.inputStopWork = {registration, refs: existing?.refs ?? proposal.refs, preparation,
      ...(existing?.receipt ? {receipt: existing.receipt} : {})}
    const markerFor = (refs: readonly NativeInputRef[], previousStartSeq?: number): NativeInputLinkV1 | undefined => {
      if (!preparation) return undefined
      return nativeInputLink({schemaVersion: 1, encoding: 'native-input-link-v1', preparation, refs,
        workSha256: nativeInputWorkSha256(this.session.id, preparation, refs),
        ...(previousStartSeq === undefined ? {mode: 'claim', proposal: {target: proposal.target,
          revision: proposal.revision, stateSha256: proposal.stateSha256}} : {mode: 'resume', previousStartSeq})}, this.session.id)
    }
    if (decision.kind === 'resume') {
      if (!existing || nativeInputSha256(existing.refs) !== nativeInputSha256(decision.refs)
        || preparation && nativeInputSha256(preparation) !== nativeInputSha256(existing.preparation)) return refused('INPUT_RESUME_NOT_PROVEN')
      if (hook.schemaVersion === 2 ? !existing.receipt || !this.inbox.canResumeLinked(existing.receipt)
        : !this.inbox.canResume(decision.refs)) return refused('INPUT_RESUME_NOT_PROVEN')
      const resumeProof = this.inbox.prepareResume(proposal, decision.refs, hook.schemaVersion === 2 ? existing.receipt : undefined)
      if (!resumeProof) return refused('INPUT_RESUME_NOT_PROVEN')
      const marker = markerFor(decision.refs, existing.receipt?.startSeq)
      if (hook.schemaVersion === 2 && !marker) return refused('INPUT_LINK_INVALID_OR_OVERSIZED')
      return {kind: 'admitted', admission: {registration, proposal, identity: decision.identity, resumeProof, preparation, marker,
        ...(ownedContinuations ? {ownedContinuations} : {}), ...(completedWorkRequired ? {completedWorkRequired} : {})}}
    }
    if (existing) return refused('INPUT_EXISTING_WORK_NOT_SELECTED')
    const marker = markerFor(proposal.refs)
    if (hook.schemaVersion === 2 && !marker) return refused('INPUT_LINK_INVALID_OR_OVERSIZED')
    return {kind: 'admitted', admission: {registration, proposal, identity: decision.identity, preparation, marker,
      ...(ownedContinuations ? {ownedContinuations} : {}), ...(completedWorkRequired ? {completedWorkRequired} : {})}}
  }

  private abortInput(admission: InputAdmission, code: string, stage: 'claim' | 'final', claim?: NativeInputClaim,
    proposal = admission.proposal): never {
    this.blockInput(admission.registration, code, stage, proposal, claim)
    this.cancel({kind: 'hook', reason: INPUT_ADMISSION_ABORT_REASON}, {keepInbox: true})
    if (this.phase.kind !== 'running') throw Error('native input driver reservation lost')
    this.phase.abort.signal.throwIfAborted()
    throw Error('native input abort was not recorded')
  }

  /** Check native receipt and owner readiness before assembly and at both request edges. */
  private checkInput(admission: InputAdmission, messages: readonly UserMessage[]): void {
    const claim = admission.claim!
    const matches = (): boolean => this.inbox.matchesClaim(claim)
      && (admission.supplement?.claims.every(owned => this.inbox.matchesClaim(owned.claim)) ?? true)
    if (this.phase.kind !== 'running') this.abortInput(admission, 'INPUT_DRIVER_CHANGED', 'final', claim)
    const signal = this.phase.abort.signal
    signal.throwIfAborted()
    if (!admission.registration.active || this.inputAdmission !== admission.registration || !matches()) {
      this.abortInput(admission, 'INPUT_FINAL_IDENTITY_CHANGED', 'final', claim)
    }
    let result: ReturnType<NativeInputAdmissionHook['check']>
    try {
      const hook = admission.registration.hook
      const input = {proposal: admission.proposal, claim, identity: admission.identity, messages,
        ...(admission.continuation ? {continuation: true as const} : {})}
      if (hook.schemaVersion === 2) {
        if (!admission.preparation) this.abortInput(admission, 'INPUT_PREPARATION_RECEIPT_INVALID', 'final', claim)
        result = hook.check({...input, preparation: admission.preparation,
          ...(admission.receipt ? {receipt: admission.receipt} : {}),
          ...(admission.supplement ? {supplement: admission.supplement} : {})})
      } else result = hook.check(input)
    }
    catch {this.abortInput(admission, 'INPUT_FINAL_CHECK_FAILED', 'final', claim)}
    if (result.kind !== 'allow') this.abortInput(admission, result.code, 'final', claim)
    signal.throwIfAborted()
    if (!admission.registration.active || this.inputAdmission !== admission.registration || !matches()) {
      this.abortInput(admission, 'INPUT_FINAL_IDENTITY_CHANGED', 'final', claim)
    }
  }

  /** Consume the whole actual proposal under the original work. No partial
   * filtering or re-admission can turn unrelated messages into maintenance. */
  private claimSupplement(previous: InputAdmission, proposal: NativeInputProposal,
    position: {turn: number; step: number}): {admission: InputAdmission; messages: UserMessage[]} {
    const registration = previous.registration, hook = registration.hook, parent = previous.receipt
    if (hook.schemaVersion !== 2 || !hook.recognizeSupplement || !parent || parent.actualTurn !== position.turn
      || position.step < 2 || proposal.target !== 'next-step') {
      this.abortInput(previous, 'INPUT_CONTINUATION_SCOPE_INVALID', 'claim')
    }
    const entries = proposal.refs.map(ref => registration.nominations?.get(nativeInputSha256(ref)))
    if (!entries.length || entries.some(entry => !entry || entry.claimed || entry.turn !== position.turn
      || entry.parentSha256 !== nativeInputSha256(parent))) {
      this.abortInput(previous, 'INPUT_CONTINUATION_NOMINATION_UNKNOWN', 'claim', undefined, proposal)
    }
    const nominated = entries as OwnedContinuation[]
    let recognized: ReturnType<NonNullable<NativeInputAdmissionHookV2['recognizeSupplement']>>
    try {recognized = hook.recognizeSupplement({parent, ...position, proposal,
      nominations: nominated.map(entry => ({ref: entry.ref, ownerToken: entry.ownerToken}))})}
    catch {this.abortInput(previous, 'INPUT_CONTINUATION_RECOGNITION_FAILED', 'claim')}
    if (recognized.kind !== 'allow') this.abortInput(previous, recognized.code, 'claim')
    if (this.phase.kind !== 'running') this.abortInput(previous, 'INPUT_DRIVER_CHANGED', 'claim')
    this.phase.abort.signal.throwIfAborted()
    if (!registration.active || this.inputAdmission !== registration || !this.inbox.matches(proposal)) {
      this.abortInput(previous, 'INPUT_CONTINUATION_PROPOSAL_CHANGED', 'claim')
    }
    const result = this.inbox.claimExact(proposal, position.turn)
    const retained = new Map((this.inputStopWork?.refs ?? parent.refs).map(ref => [nativeInputSha256(ref), ref]))
    for (const ref of result.claim.refs) retained.set(nativeInputSha256(ref), ref)
    this.inputStopWork = {registration, refs: [...retained.values()], preparation: parent.preparation,
      receipt: parent, ownedContinuations: true}
    for (const entry of nominated) entry.claimed = true
    if (result.kind === 'blocked') this.abortInput(previous, 'INPUT_CONTINUATION_CLAIM_CHANGED', 'claim', result.claim, proposal)
    const supplement: NativeInputSupplementV1 = Object.freeze({parent, ...position, proposal,
      claims: Object.freeze([...(previous.supplement?.claims ?? []), Object.freeze({claim: result.claim,
        ownerTokens: Object.freeze(nominated.map(entry => entry.ownerToken))})])})
    return {admission: {...previous, continuation: true, supplement}, messages: [...result.claim.messages]}
  }

  /** Only this native writer mints the live receipt after its real checkpoint.
   * Core persists its association outside any native inbox/import lease. */
  private async checkpointInput(admission: InputAdmission, stepStartSeq: number, messages: readonly UserMessage[]): Promise<void> {
    const hook = admission.registration.hook
    if (hook.schemaVersion !== 2 || admission.startSeq === undefined) return
    if (this.phase.kind !== 'running') this.abortInput(admission, 'INPUT_DRIVER_CHANGED', 'final', admission.claim)
    const signal = this.phase.abort.signal
    this.checkInput(admission, messages)
    this.#assertSelectionCurrent()
    let flushed: boolean
    try {flushed = await this.awaitInputOperation(this.ctx.sessions.flush(this.session), signal, admission.registration)}
    catch {
      if (this.inputStop) await this.whenInputStopSettled()
      signal.throwIfAborted()
      this.abortInput(admission, 'INPUT_LINK_FLUSH_FAILED', 'final', admission.claim)
    }
    if (signal.aborted) await this.whenInputStopSettled()
    signal.throwIfAborted()
    if (!flushed) this.abortInput(admission, 'INPUT_LINK_FLUSH_FAILED', 'final', admission.claim)
    this.checkInput(admission, messages)
    this.#assertSelectionCurrent()
    const receipt = this.inbox.linkReceipt(admission.startSeq)
    if (!receipt || receipt.firstStepStartSeq !== stepStartSeq || receipt.actualTurn !== this.phase.turn
      || receipt.workSha256 !== admission.marker?.workSha256
      || nativeInputSha256(receipt.preparation) !== nativeInputSha256(admission.preparation)) {
      this.abortInput(admission, 'INPUT_LINK_CHANGED', 'final', admission.claim)
    }
    let outcome: Awaited<ReturnType<NativeInputAdmissionHookV2['checkpoint']>>
    this.inputStopWork = {registration: admission.registration, refs: receipt.refs, preparation: receipt.preparation, receipt,
      ...(admission.ownedContinuations ? {ownedContinuations: true} : {})}
    try {outcome = await this.awaitInputOperation(hook.checkpoint(receipt, signal), signal, admission.registration)}
    catch {
      if (this.inputStop) await this.whenInputStopSettled()
      signal.throwIfAborted()
      this.abortInput(admission, 'INPUT_CHECKPOINT_FAILED', 'final', admission.claim)
    }
    if (signal.aborted) await this.whenInputStopSettled()
    signal.throwIfAborted()
    if (outcome?.kind !== 'allow') this.abortInput(admission, outcome?.code ?? 'INPUT_CHECKPOINT_BLOCKED', 'final', admission.claim)
    this.#assertSelectionCurrent()
    admission.receipt = receipt
    this.checkInput(admission, messages)
    this.#assertSelectionCurrent()
  }

  runMaintenance<T>(job: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.phase.kind !== 'idle') throw new Error(`agent "${this.id}" already has active work`)
    const done = Promise.withResolvers<void>()
    const maintenance: Phase = {
      kind: 'maintenance',
      abort: new AbortController(),
      lastTurn: this.phase.lastTurn,
      wakeRequested: false,
    }
    this.setPhase(maintenance)
    this.activityDone = done.promise
    return (async () => {
      try {
        return await job(maintenance.abort.signal)
      } finally {
        if (this.inputStop) await this.whenInputStopSettled()
        this.setPhase({ kind: 'idle', lastTurn: maintenance.lastTurn })
        const cause = abortedCancelCause(maintenance.abort.signal)
        if (!this.programmaticTurnPoisoned && !this.openingCompletionBlocked && cause?.kind !== 'disposed'
          && maintenance.wakeRequested && (this.inbox.hasPending || this.existingInputWork)) this.wakeDriver()
        done.resolve()
      }
    })()
  }

  /**
   * Append one complete assistant turn without entering the request pipeline.
   * The operation identity is in the first turn record as well as the message,
   * so a cold retry can recognize a failure before the message existed. Flush
   * still owns durability; a partial turn is never continued by a second writer.
   */
  async commitProgrammaticAssistant(input: ProgrammaticAssistantCommit): Promise<ProgrammaticAssistantCommitResult> {
    if (this.phase.kind !== 'idle' || this.programmaticTurnPoisoned || this.inputCompletionBlocked || this.openingCompletionBlocked) return { kind: 'busy' }
    const identity = programmaticTurnIdentity(input)
    return this.runMaintenance<ProgrammaticAssistantCommitResult>(async () => {
      // Include inherited history: the operation may have committed before a
      // resume, or the flush acknowledgement may have been lost.
      const inspection = inspectProgrammaticCommit(this.session.snapshotEvents(), input, identity)
      if (inspection.kind === 'unknown') return inspection
      if (inspection.kind === 'complete') {
        try {
          if (!await this.ctx.sessions.flush(this.session)) {
            return { kind: 'unknown', reason: 'no durable session listener confirmed the flush' }
          }
          return { kind: 'committed', turn: inspection.turn, messageId: input.messageId }
        } catch {
          return { kind: 'unknown', reason: 'session flush did not confirm durability' }
        }
      }
      if (this.uncertainProgrammaticOperations.has(input.operationId)) {
        return { kind: 'unknown', reason: 'earlier append stopped before its message boundary' }
      }
      if (this.loopCtx.sessionProjections.stateOf(this.session, 'turnBoundary')?.openTurnStartSeq != null) {
        return { kind: 'unknown', reason: 'session already has an open turn', code: 'PROGRAMMATIC_OPEN_TURN' }
      }

      // Assistant-only transcripts are readable, but a later system prompt
      // cannot acquire their protected head. Refuse a new turn before writing
      // behind that history; exact committed retries above remain read-only.
      const surfaceHead = this.session.surface.nodes[0]
      if (surfaceHead !== undefined && this.session.eventAt(surfaceHead)?.type !== 'system/message') {
        return { kind: 'unknown', reason: 'session surface has no protected system prompt head',
          code: 'PROGRAMMATIC_MISSING_SYSTEM_HEAD' }
      }

      const phase: Phase = this.phase
      if (phase.kind !== 'maintenance') return { kind: 'unknown', reason: 'maintenance reservation was lost' }
      const turn = phase.lastTurn + 1
      const step = 1
      const message = freezeMessage({
        id: brandString<AssistantMessage['id']>(input.messageId),
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: input.text }],
        source: input.source,
      })
      try {
        this.session.append('turn/start', { turn, programmatic: identity })
        phase.lastTurn = turn
        this.session.append('step/start', { turn, step })
        // The first surface node must already own the system slot when the
        // next real request is admitted. An empty native head records no
        // prompt and invokes no assembly hooks; ordinary prompt reconciliation
        // can replace it or append an in-history update without moving story.
        if (surfaceHead === undefined) {
          for (const { message, intent } of this.systemPrompt.project('', { inHistory: false, startsSeries: true })) {
            this.session.append('system/message', { turn, step, message }, intent)
          }
        }
        this.session.append('assistant/message', { turn, step, message, stream: [] }, { surfaceOp: 'append' })
        this.session.append('step/end', { turn, step })
        this.session.append('turn/end', { turn, reason: { kind: 'completed' } })
      } catch {
        if (this.session.snapshotEvents().some(event => event.type === 'turn/start'
          && event.data.programmatic?.operationId === input.operationId)) {
          // An append acknowledgement can fail after the first event was accepted.
          // Keep the next turn number ahead of that durable ownership boundary.
          phase.lastTurn = Math.max(phase.lastTurn, turn)
          this.uncertainProgrammaticOperations.add(input.operationId)
        }
        this.closePartialProgrammaticTurn(turn, step)
        return { kind: 'unknown', reason: 'append stopped before a complete turn was confirmed' }
      }
      try {
        if (!await this.ctx.sessions.flush(this.session)) {
          return { kind: 'unknown', reason: 'no durable session listener confirmed the flush' }
        }
        return { kind: 'committed', turn, messageId: input.messageId }
      } catch {
        return { kind: 'unknown', reason: 'session flush did not confirm durability' }
      }
    })
  }

  /** Confirm an exact operation under the same reservation as its writer; never append on lookup. */
  async lookupProgrammaticAssistantCommit(input: ProgrammaticAssistantCommit): Promise<ProgrammaticAssistantLookupResult> {
    if (this.phase.kind !== 'idle' || this.programmaticTurnPoisoned) return {status:'unknown'}
    const identity = programmaticTurnIdentity(input)
    return this.runMaintenance<ProgrammaticAssistantLookupResult>(async () => {
      const inspection = inspectProgrammaticCommit(this.session.snapshotEvents(), input, identity)
      if (inspection.kind === 'unknown') return {status:'unknown',...(inspection.code ? {code:inspection.code} : {})}
      if (inspection.kind === 'absent' && this.uncertainProgrammaticOperations.has(input.operationId)) {
        return {status:'unknown'}
      }
      if (this.loopCtx.sessionProjections.stateOf(this.session, 'turnBoundary')?.openTurnStartSeq != null) {
        return {status:'unknown',code:'PROGRAMMATIC_OPEN_TURN'}
      }
      try {
        if (!await this.ctx.sessions.flush(this.session)) return {status:'unknown'}
        return inspection.kind === 'complete' ? {status:'committed',turn:inspection.turn} : {status:'absent'}
      } catch { return {status:'unknown'} }
    })
  }

  /** Run one model turn from the assembled system prompt without creating a user message. */
  async generateProgrammaticAssistant(input: ProgrammaticAssistantGeneration): Promise<ProgrammaticAssistantGenerationResult> {
    if(input?.opening!==undefined)return this.generateOwnedOpening(input)
    const valid = (value: unknown): value is string => typeof value === 'string' && value.length > 0
      && value.length <= 256 && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value)
    if (!input || !valid(input.operationId) || !valid(input.messageId)
      || typeof input.instruction !== 'string' || !input.instruction.trim()
      || new TextEncoder().encode(input.instruction).length > 65_536) {
      throw new Error('invalid programmatic generation identity or instruction')
    }
    if (this.phase.kind !== 'idle' || this.programmaticTurnPoisoned || this.inputCompletionBlocked
      || this.openingCompletionBlocked || this.inbox.hasPending) return {kind: 'busy'}
    const events = this.session.snapshotEvents()
    const matching = events.filter((event): event is SessionEvent<'assistant/message'> =>
      event.type === 'assistant/message' && event.data.message.id === input.messageId)
    if (matching.length > 0) {
      if (matching.length !== 1 || matching[0]!.data.message.source.kind !== 'model') {
        return {kind: 'unknown', reason: 'generation identity belongs to a different message'}
      }
      const turn = matching[0]!.data.turn
      if (!events.some(event => event.type === 'turn/end' && event.data.turn === turn
        && event.data.reason.kind === 'completed')) return {kind: 'unknown', reason: 'generation turn is incomplete'}
      if (!await this.ctx.sessions.flush(this.session)) return {kind: 'unknown', reason: 'generation flush is not durable'}
      return {kind: 'committed', turn, messageId: input.messageId}
    }
    if (events.some(event => event.type === 'turn/start' && !events.some(end =>
      end.type === 'turn/end' && end.data.turn === event.data.turn))) {
      return {kind: 'unknown', reason: 'session contains an open turn'}
    }
    const driver = Promise.withResolvers<void>()
    this.activityDone = driver.promise
    this.setPhase({kind: 'running', abort: new AbortController(), turn: this.phase.lastTurn,
      step: 0, wakeRequested: false, programmatic: {operationId: input.operationId,
        messageId: input.messageId, instruction: input.instruction}})
    this.loopCtx.agents.withInitiator(this, () => this.kick()).then(driver.resolve, driver.reject)
    // This operation owns only its opening turn. A queued player follow-up may
    // start a new driver immediately after it, without delaying this receipt.
    await driver.promise
    const settled = this.session.snapshotEvents()
    const generated = settled.find((event): event is SessionEvent<'assistant/message'> =>
      event.type === 'assistant/message' && event.data.message.id === input.messageId)
    const turn = generated?.data.turn
    if (generated && settled.some(event => event.type === 'turn/end' && event.data.turn === turn
      && event.data.reason.kind === 'completed') && await this.ctx.sessions.flush(this.session)) {
      return {kind: 'committed', turn: turn!, messageId: input.messageId}
    }
    return {kind: 'unknown', reason: 'generation did not complete durably'}
  }

  private openingOwnerIdentity(work:OpeningWork):NativeOpeningOwnerIdentityV1 {
    return Object.freeze({kind:'programmatic-opening',identity:work.identity,invocationRef:openingEventRefV1(work.invocation)})
  }
  private assertOpeningLive(work:OpeningWork,signal:AbortSignal):void {
    signal.throwIfAborted()
    if(this.inputDisposed||!nativeAdmissionAgents.has(this)||!work.registration.active
      ||this.openingMaterial!==work.registration
      ||this.session.snapshotEvents()[Number(work.invocation.seq)]!==work.invocation)
      throw Error('OPENING_OWNER_REVOKED')
    if(this.phase.kind==='running'&&this.phase.programmatic?.opening!==work)throw Error('OPENING_PHASE_CHANGED')
    if(this.phase.kind==='maintenance'&&this.openingRecovery!==work)throw Error('OPENING_PHASE_CHANGED')
    if(this.phase.kind==='idle')throw Error('OPENING_PHASE_CHANGED')
  }
  /** Reservation may contain only the captured prefix and this live invocation.
   * Repeat after the callback: synchronous owner hooks can append or revoke. */
  private assertOpeningReservation(work:OpeningWork,phase:Extract<Phase,{kind:'running'}>,prefixLength:number):void {
    this.assertOpeningLive(work,phase.abort.signal)
    const events=this.session.snapshotEvents()
    if(this.phase!==phase||phase.programmatic?.opening!==work||this.inbox.hasPending
      ||events.length!==prefixLength+1||work.invocation.seq!==prefixLength
      ||events[prefixLength]!==work.invocation||this.session.seq!==events.length) {
      throw Error('OPENING_RESERVATION_CHANGED')
    }
  }
  private checkOpeningIdentity(registration:OpeningRegistration,
    input:Extract<NativeOpeningMaterialCheckV1,{identity:NativeOpeningIdentityV1}>):void {
    input.signal.throwIfAborted()
    if(this.inputDisposed||!registration.active||this.openingMaterial!==registration||!nativeAdmissionAgents.has(this))
      throw Error('OPENING_OWNER_REVOKED')
    const checked=nativeRequestMaterialOwnerCheckV1(registration.owner.check(input))
    if(checked.kind!=='allow')throw Error(checked.code)
    input.signal.throwIfAborted()
    if(!registration.active||this.openingMaterial!==registration)throw Error('OPENING_OWNER_REVOKED')
  }
  /** Separate reservation. An incomplete durable marker is an actionable
   * recovery anchor, never permission to run a second request with that id. */
  private async generateOwnedOpening(input:ProgrammaticAssistantGeneration):Promise<ProgrammaticAssistantGenerationResult> {
    const identity=this.openingIdentity(input),registration=this.openingMaterial
    if(this.phase.kind!=='idle'||this.programmaticTurnPoisoned||this.inputCompletionBlocked||this.inputDisposed)return {kind:'busy'}
    if(!registration?.active)return {kind:'unknown',reason:'OPENING_OWNER_REGISTRATION_REQUIRED'}
    const inspected=inspectNativeOpeningGenerationV1(this.session,identity,this.ctx.sessions.messageProjections)
    if(inspected.kind==='unknown') {
      if(hasUnclosedNativeOpeningV1(this.session,this.ctx.sessions.messageProjections))this.openingDomainCompletion={
        status:'unknown',code:inspected.code,...inspected.invocationRef?{invocationRef:inspected.invocationRef}:{}}
      return {kind:'unknown',reason:inspected.code}
    }
    if(inspected.kind==='complete') {
      return this.runMaintenance(async signal=>{
        const work:OpeningWork={registration,identity,invocation:inspected.invocation,attempts:new Map()}
        this.openingRecovery=work
        try {
          this.checkOpeningIdentity(registration,{identity,phase:'cold-closing-recovery',signal})
          if(!await this.closeOwnedOpening(work,signal))return {kind:'unknown',reason:this.openingDomainCompletion?.code??'OPENING_CLOSING_UNKNOWN'}
          const actual=inspectNativeOpeningGenerationV1(this.session,identity,this.ctx.sessions.messageProjections)
          if(actual.kind!=='complete'||!actual.receiptEvent)return {kind:'unknown',reason:'OPENING_GENERATION_RECEIPT_CHANGED'}
          return {kind:'committed',turn:actual.receipt.turn,messageId:identity.messageId,
            generatedReceiptRef:openingEventRefV1(actual.receiptEvent),receipt:actual.receipt}
        }catch(error) {
          const code=error instanceof Error?error.message:'OPENING_COLD_RECOVERY_FAILED'
          this.openingDomainCompletion={status:'unknown',code,invocationRef:openingEventRefV1(inspected.invocation)}
          return {kind:'unknown',reason:code}
        }finally {if(this.openingRecovery===work)this.openingRecovery=undefined}
      })
    }
    if(this.openingCompletionBlocked||this.inbox.hasPending)return {kind:'busy'}
    const events=this.session.snapshotEvents()
    if(events.some(event=>event.type==='turn/start'&&!events.some(end=>end.type==='turn/end'&&end.data.turn===event.data.turn)))
      return {kind:'unknown',reason:'OPENING_NATIVE_TURN_ALREADY_OPEN'}
    const driver=Promise.withResolvers<void>(),phase:Extract<Phase,{kind:'running'}>={kind:'running',abort:new AbortController(),
      turn:this.phase.lastTurn,step:0,wakeRequested:false,
      programmatic:{operationId:identity.operationId,messageId:identity.messageId,instruction:identity.instruction}}
    this.activityDone=driver.promise
    this.setPhase(phase)
    try {
      this.checkOpeningIdentity(registration,{identity,phase:'invocation-reservation',signal:phase.abort.signal})
      // setPhase changes the field and emits synchronous callbacks. Re-read the
      // full union rather than retaining the earlier idle admission narrowing.
      if((this.phase as Phase)!==phase||this.inbox.hasPending)throw Error('OPENING_RESERVATION_CHANGED')
      const prefix=this.session.snapshotEvents(),record=validateNativeOpeningInvocationV1(sealNativeOpeningRecordV1({
        schemaVersion:1 as const,encoding:'native-programmatic-opening-invocation-v1' as const,identity,
        expectedTurn:phase.turn+1,prefix:{eventCount:prefix.length,inheritedEventCount:this.session.inheritedEventCount,
          sha256:nativeInputSha256(prefix)}},'invocationSha256')),
        invocation=this.session.append('opening/invocation',record),work:OpeningWork={registration,identity,invocation,attempts:new Map()}
      phase.programmatic!.opening=work
      this.openingDomainCompletion={status:'pending',invocationRef:openingEventRefV1(invocation)}
      this.assertOpeningLive(work,phase.abort.signal)
      // Reservation persistence settles before the driver can start a turn.
      // Cancellation does not race this write or release its Agent ownership.
      const flushed=await this.ctx.sessions.flush(this.session)
      this.assertOpeningLive(work,phase.abort.signal)
      if(!flushed)throw Error('OPENING_INVOCATION_FLUSH_UNCONFIRMED')
      this.assertOpeningReservation(work,phase,prefix.length)
      // The original basis now ends immediately before this owned invocation.
      // Carry its actual ref; the post-flush gate must not require Phase-A yet.
      this.checkOpeningIdentity(registration,{identity:work.identity,phase:'invocation-reserved',
        invocationRef:openingEventRefV1(work.invocation),signal:phase.abort.signal})
      this.assertOpeningReservation(work,phase,prefix.length)
      this.loopCtx.agents.withInitiator(this,()=>this.kick()).then(driver.resolve,driver.reject)
    }catch(error) {
      const code=error instanceof Error?error.message:'OPENING_RESERVATION_FAILED'
      if(phase.programmatic?.opening)this.openingDomainCompletion={status:'unknown',code,
        invocationRef:openingEventRefV1(phase.programmatic.opening.invocation)}
      if((this.phase as Phase)===phase)this.setPhase({kind:'idle',lastTurn:phase.turn})
      driver.resolve()
      return {kind:'unknown',reason:code}
    }
    await driver.promise
    const actual=inspectNativeOpeningGenerationV1(this.session,identity,this.ctx.sessions.messageProjections)
    if(actual.kind==='complete'&&actual.receiptEvent&&this.openingDomainCompletion?.status==='settled')
      return {kind:'committed',turn:actual.receipt.turn,messageId:identity.messageId,
        generatedReceiptRef:openingEventRefV1(actual.receiptEvent),receipt:actual.receipt}
    return {kind:'unknown',reason:this.openingDomainCompletion?.code??'OPENING_GENERATION_NOT_COMPLETED'}
  }

  private async closeOwnedOpening(work:OpeningWork,signal:AbortSignal):Promise<boolean> {
    const fail=(code:string):false=>{
      this.openingDomainCompletion={status:'unknown',code,invocationRef:openingEventRefV1(work.invocation)}
      return false
    }
    try {
      this.assertOpeningLive(work,signal)
      if(!await this.ctx.sessions.flush(this.session))return fail('OPENING_TERMINAL_FLUSH_UNCONFIRMED')
      this.assertOpeningLive(work,signal)
      let actual=inspectNativeOpeningGenerationV1(this.session,work.identity,this.ctx.sessions.messageProjections)
      if(actual.kind!=='complete')return fail(actual.kind==='unknown'?actual.code:'OPENING_INVOCATION_MISSING')
      let receiptEvent=actual.receiptEvent
      if(!receiptEvent)receiptEvent=this.session.append('opening/generated-receipt',actual.receipt)
      if(!await this.ctx.sessions.flush(this.session))return fail('OPENING_RECEIPT_FLUSH_UNCONFIRMED')
      this.assertOpeningLive(work,signal)
      actual=inspectNativeOpeningGenerationV1(this.session,work.identity,this.ctx.sessions.messageProjections)
      if(actual.kind!=='complete'||!actual.receiptEvent||actual.receiptEvent!==receiptEvent)
        return fail('OPENING_GENERATION_RECEIPT_CHANGED')
      const receipt=actual.receipt,generatedReceiptRef=openingEventRefV1(receiptEvent),owner=this.openingOwnerIdentity(work),
        events=this.session.snapshotEvents(),originalModelMessages=receipt.outputs.map(output=>{
          const event=events[output.eventRef.seq]
          if(!event||event.type!=='assistant/message'||nativeInputSha256(event.data.message)!==output.messageSha256)
            throw Error('OPENING_GENERATION_OUTPUT_CHANGED')
          return Object.freeze({eventRef:output.eventRef,message:event.data.message})
        }),toolEvents=receipt.toolEvents.map(ref=>{
          const event=events[ref.eventRef.seq]
          if(!event||(event.type!=='tool/call'&&event.type!=='tool/result')||event.type!==ref.type
            ||nativeInputSha256(event)!==ref.eventRef.sha256)throw Error('OPENING_GENERATION_TOOL_CHANGED')
          return event
        })
      this.openingDomainCompletion={status:'pending',invocationRef:owner.invocationRef,generatedReceiptRef}
      this.checkOpeningIdentity(work.registration,{identity:work.identity,phase:'closing-precommit',signal})
      this.assertOpeningLive(work,signal)
      // Await the real publisher to settlement even when its signal is revoked.
      // A late success cannot make a replaced registration current.
      const acknowledgement=await work.registration.owner.closing(Object.freeze({schemaVersion:1,owner,
        generatedReceiptRef,receipt,originalModelMessages:Object.freeze(originalModelMessages),
        toolEvents:Object.freeze(toolEvents),signal}))
      this.assertOpeningLive(work,signal)
      const checked=nativeOpeningClosingAcknowledgementV1(acknowledgement,receipt.receiptSha256),
        current=inspectNativeOpeningGenerationV1(this.session,work.identity,this.ctx.sessions.messageProjections)
      if(current.kind!=='complete'||!current.receiptEvent||nativeInputSha256(current.receipt)!==nativeInputSha256(receipt)
        ||nativeInputSha256(current.receiptEvent)!==generatedReceiptRef.sha256)return fail('OPENING_CLOSING_PROOF_CHANGED')
      if(checked.kind!=='settled') {
        this.openingDomainCompletion={status:checked.kind,code:checked.code,invocationRef:owner.invocationRef,generatedReceiptRef}
        return false
      }
      const ack=validateNativeOpeningClosingAckV1(sealNativeOpeningRecordV1({schemaVersion:1 as const,
        encoding:'native-programmatic-opening-closing-ack-v1' as const,invocationRef:owner.invocationRef,
        generatedReceiptRef,receiptSha256:receipt.receiptSha256,ownerReceiptSha256:checked.ownerReceiptSha256},'ackSha256'))
      if(current.closingAck) {
        if(nativeInputSha256(current.closingAck.data)!==nativeInputSha256(ack))return fail('OPENING_CLOSING_ACK_CHANGED')
      }else this.session.append('opening/closing-ack',ack)
      if(!await this.ctx.sessions.flush(this.session))return fail('OPENING_CLOSING_ACK_FLUSH_UNCONFIRMED')
      this.assertOpeningLive(work,signal)
      const closed=inspectNativeOpeningGenerationV1(this.session,work.identity,this.ctx.sessions.messageProjections)
      if(closed.kind!=='complete'||!closed.closingAck||nativeInputSha256(closed.closingAck.data)!==nativeInputSha256(ack))
        return fail('OPENING_CLOSING_ACK_CHANGED')
      this.openingDomainCompletion={status:'settled',invocationRef:owner.invocationRef,generatedReceiptRef}
      return true
    }catch(error){return fail(signal.aborted?'OPENING_CLOSING_REVOKED':error instanceof Error?error.message:'OPENING_CLOSING_FAILED')}
  }

  /** Close only boundaries that this append opened; an unconfirmable closure poisons future writes. */
  private closePartialProgrammaticTurn(turn: number, step: number): void {
    try {
      const events = this.session.snapshotEvents()
      const turnStarted = events.some(event => event.type === 'turn/start' && event.data.turn === turn)
      if (!turnStarted) return
      const stepStarted = events.some(event => event.type === 'step/start'
        && event.data.turn === turn && event.data.step === step)
      const stepEnded = events.some(event => event.type === 'step/end'
        && event.data.turn === turn && event.data.step === step)
      const messageExists = events.some(event => event.type === 'assistant/message'
        && event.data.turn === turn && event.data.step === step)
      if (stepStarted && !stepEnded) this.session.append('step/end', { turn, step })
      const stepClosed = this.session.snapshotEvents().some(event => event.type === 'step/end'
        && event.data.turn === turn && event.data.step === step)
      if (!events.some(event => event.type === 'turn/end' && event.data.turn === turn)) {
        this.session.append('turn/end', {
          turn,
          reason: messageExists && stepClosed
            ? { kind: 'completed' }
            : { kind: 'error', error: { code: 'UNKNOWN', message: 'programmatic assistant append failed' } },
        })
      }
      if (!this.session.snapshotEvents().some(event => event.type === 'turn/end' && event.data.turn === turn)) {
        this.programmaticTurnPoisoned = true
      }
    } catch {
      this.programmaticTurnPoisoned = true
    }
  }

  /**
   * Start one driver, or latch its wake behind maintenance or an aborted
   * activity. A wake sent while idle always opens its turn boundary, even
   * when its message was cleared; only a latched replay is suppressed when
   * the queue no longer holds the wake.
   * @param wakeAfterAbort - the {@link send} classification, captured before
   *   the inbox insertion so a reentrant cancel cannot reclassify it.
   */
  private wakeDriver(wakeAfterAbort = false): void {
    if (this.programmaticTurnPoisoned || this.inputDisposed || this.inputStop || this.openingCompletionBlocked
      || this.inputCompletionBlocked || this.inputAdmission?.stopOwner && this.inputWakeStopped) return
    if (this.phase.kind !== 'idle') {
      // Maintenance and aborted drivers cannot deliver the wake: latch it for
      // replay at convergence. Live drivers claim queued work themselves;
      // disposal never latches, so teardown waits on no model turn.
      const reason = abortedCancelCause(this.phase.abort.signal)
      if (reason?.kind !== 'disposed' && (this.phase.kind === 'maintenance' || wakeAfterAbort
        || (this.phase.kind === 'running' && this.phase.programmatic !== undefined))) {
        this.phase.wakeRequested = true
      }
      return
    }
    const driver = Promise.withResolvers<void>()
    this.activityDone = driver.promise
    this.setPhase({
      kind: 'running',
      abort: new AbortController(),
      turn: this.phase.lastTurn,
      step: 0,
      wakeRequested: false,
    })
    this.loopCtx.agents.withInitiator(this, () => this.kick()).then(driver.resolve, driver.reject)
  }

  async whenIdle(): Promise<void> {
    let activity: Promise<void>
    do {
      await (activity = this.activityDone)
      if (this.inputStop) await this.whenInputStopSettled()
    } while (activity !== this.activityDone)
  }

  /** Report one failure at its live boundary, then preserve it for driver containment. */
  private throwError(error: unknown): never {
    const turn = this.phase.kind === 'running' ? this.phase.turn : this.phase.lastTurn
    const step = this.phase.kind === 'running' ? this.phase.step : 0
    this.dispatch.emit('agent/error', { turn, step, error })
    throw error
  }

  private async kick(): Promise<void> {
    try {
      while (await this.turn()) {}
    } catch (_error) {
      // Reported failures and cancellation are contained at the driver boundary.
    } finally {
      if (this.inputStop) await this.whenInputStopSettled()
      /* v8 ignore next -- kick owns a running phase until this driver boundary */
      if (this.phase.kind === 'running') {
        const { turn, wakeRequested } = this.phase
        const blocked = this.inputAdmissionBlocked
        // Only a blocked owner work needs its association after driver release.
        // A completed work must not be included in an unrelated idle stop.
        if (!blocked && !this.inputCompletionBlocked) this.inputStopWork = undefined
        this.inputAdmissionBlocked = undefined
        this.existingInputWork = undefined
        this.inputOnlyWakeLatched = false
        if (!this.inputCompletionBlocked) this.inputAdmission?.nominations?.clear()
        this.setPhase({ kind: 'idle', lastTurn: turn })
        if (blocked) {
          // Notify only after reservation release; never await owner recovery.
          if (blocked.registration.active && !this.inputDisposed) {
            try {blocked.registration.hook.onBlocked?.(blocked.notice)} catch { /* notification cannot restart input */ }
          }
        } else if (wakeRequested && this.inbox.hasPending && !this.openingCompletionBlocked) this.wakeDriver()
      }
    }
  }

  private async preStep(target: InboxTarget, position: { turn: number; step: number }, offered?: InputAdmission,
    previousAdmission?: InputAdmission): Promise<PreparedStep> {
    /* v8 ignore next -- private callers establish the running phase before proposing a step */
    if (this.phase.kind !== 'running') throw new Error(`agent "${this.id}": pre-step outside running phase`)
    const activeOpening=this.phase.programmatic?.opening
    // A readable old assistant-only transcript cannot acquire a later system
    // head. Refuse before claim, leaving the original input durably pending.
    this.systemPrompt.assertCanProject()
    const signal = this.phase.abort.signal
    const registration = this.inputAdmission
    if (previousAdmission && (!previousAdmission.registration.active || registration !== previousAdmission.registration)) {
      this.abortInput(previousAdmission, 'INPUT_HOOK_CHANGED', 'claim', previousAdmission.claim)
    }
    let admission = offered
    let supplementalMessages: UserMessage[] | undefined
    if (!admission && registration && !this.phase.programmatic) {
      if (previousAdmission?.ownedContinuations && previousAdmission.receipt && target === 'next-step') {
        let proposal: NativeInputProposal
        try {proposal = this.inbox.propose(target)}
        catch {this.abortInput(previousAdmission, 'INPUT_OWNERSHIP_UNKNOWN', 'claim')}
        if (proposal.messages.length) {
          const owned = this.claimSupplement(previousAdmission, proposal, position)
          admission = owned.admission
          supplementalMessages = owned.messages
        } else admission = {...previousAdmission, continuation: true}
      } else if (previousAdmission?.completedWorkRequired && target === 'next-step') {
        let proposal: NativeInputProposal
        try {proposal = this.inbox.propose(target)}
        catch {this.abortInput(previousAdmission, 'INPUT_OWNERSHIP_UNKNOWN', 'claim')}
        if (proposal.messages.length) {
          // A terminal owner cannot be replaced by re-admitting a different
          // work. Only its paired nominated continuation can join this turn.
          this.abortInput(previousAdmission, 'INPUT_COMPLETION_OWNER_CHANGED', 'claim', previousAdmission.claim, proposal)
        }
        admission = {...previousAdmission, continuation: true}
      } else {
        const result = await this.admitInput(target)
        if (result.kind === 'blocked') return {kind: 'reject'}
        if (result.kind === 'admitted') admission = result.admission
      }
      if (!admission) {
        // A tool result can require another request with no new queued input.
        // Preserve its work identity rather than claiming or admitting again.
        if (!previousAdmission?.claim || previousAdmission.claim.turn !== position.turn) {
          const proposal = this.inbox.propose(target)
          this.blockInput(registration, 'INPUT_CONTINUATION_WITHOUT_IDENTITY', 'claim', proposal)
          this.cancel({kind: 'hook', reason: INPUT_ADMISSION_ABORT_REASON}, {keepInbox: true})
          signal.throwIfAborted()
          return {kind: 'reject'}
        }
        admission = {...previousAdmission, continuation: true}
      }
    }
    let claimed: UserMessage[]
    if (admission) {
      signal.throwIfAborted()
      if (!admission.registration.active || this.inputAdmission !== admission.registration) this.abortInput(admission, 'INPUT_HOOK_CHANGED', 'claim')
      if (admission.continuation) {
        claimed = supplementalMessages ?? []
      } else if (admission.resumeProof) {
        const claim = this.inbox.resumeClaim(admission.resumeProof, position.turn)
        if (!claim) this.abortInput(admission, 'INPUT_RESUME_CHANGED', 'claim')
        admission.claim = claim
        this.existingInputWork = undefined
        claimed = [...claim.messages]
      } else {
        const result = this.inbox.claimExact(admission.proposal, position.turn)
        if (result.kind === 'blocked') this.abortInput(admission, 'INPUT_PROPOSAL_CHANGED', 'claim', result.claim)
        admission.claim = result.claim
        claimed = [...result.claim.messages]
      }
      const claim = admission.claim
      if (!claim || !this.inbox.matchesClaim(claim)) this.abortInput(admission, 'INPUT_CLAIM_CHANGED', 'claim', claim)
      // Claimed notifications run synchronously and can invalidate Source/head.
      // Do not start assembly or owner preparation under that stale identity.
      this.checkInput(admission, claimed)
    } else if(activeOpening&&target==='next-turn') {
      // A player queued behind this opening remains pending for domain-ready.
      // The no-player turn never consumes that real Native inbox proposal.
      claimed=[]
    }else {
      if(activeOpening&&this.inbox.nextStep.some(message=>message.source.kind==='user'))
        throw Error('OPENING_PLAYER_CONTINUATION_REFUSED')
      claimed=this.inbox.claim(target,position.turn)
    }
    const assembled = await this.loopCtx.systemPrompt.assemble(assembleContextFor(this, signal))
    const opening=this.phase.programmatic?.opening
    const generation = position.step === 1 ? this.phase.programmatic : undefined
    const assembly = generation ? {...assembled, tools: [], sections: [...assembled.sections,
      {name: 'programmatic:opening-regenerate', text: generation.instruction, interpolate: false}]} : assembled
    signal.throwIfAborted()
    const sections = renderContextSections(assembly)
    const context = this.runtimeContext.project(joinContextSections(sections), sections)
    const decision = await this.dispatch.waterfall(
      'agent/pre-step', { messages: claimed, ...position, signal },
      (): Promise<PreStepDecision> => Promise.resolve<PreStepDecision>({
        kind: 'enter',
        messages: context === undefined ? claimed : [...claimed, context],
      }),
    )
    signal.throwIfAborted()
    if (decision.kind === 'reject') return decision
    if (!generation&&!opening) return {...decision,assembly,...admission?{admission}:{}}
    if (decision.messages.some(message => message.source.kind === 'user')) {
      throw new Error('programmatic generation cannot admit a player message')
    }
    if(opening&&decision.messages.some(message=>message.content.some(block=>block.type!=='text')))
      throw Error('OPENING_NON_TEXT_CONTEXT_UNSUPPORTED')
    const systemSections = (decision as PreStepDecision & {systemSections?: readonly string[]}).systemSections ?? []
    const contextSections = decision.messages.map(message => message.content
      .filter(block => block.type === 'text').map(block => block.text).join('')).filter(Boolean)
    const effectiveAssembly = {...assembly, sections: [...assembly.sections,
      ...[...systemSections, ...contextSections].map((content, index) => ({
        name: `programmatic:context:${index}`, text: content, interpolate: false,
      }))]}
    return {...decision, messages: [], assembly: effectiveAssembly}
  }

  /** Whether the assembled tool schemas differ from the logged request header's. */
  private toolsChanged(tools: PromptAssembly['tools']): boolean {
    const baseline = this.session.requestHeader()
    if (baseline === undefined) return false
    return !headerEquals(baseline, canonicalHeader({ ...baseline, tools: [...tools] }))
  }

  /** Await the actual flush and publisher, including a cancelled in-flight
   * write. Racing abort here would release the driver before Source settles. */
  private async completeInputWork(admission: InputAdmission, end: SessionEvent,
    signal: AbortSignal): Promise<boolean> {
    const state = this.inputCompletion, checkpoint = admission.receipt
    if (!state || !checkpoint || state.registration !== admission.registration) return false
    const fail = (code: string): false => {
      state.result = Object.freeze({...state.result, status: 'unknown', code})
      // Notify the original owner after driver release, with its own refs.
      // This notice reports failure; it never unlocks the terminal gate.
      this.blockInput(admission.registration, code, 'final', admission.proposal, admission.claim)
      return false
    }
    const live = (): boolean => !signal.aborted && !this.inputStop && !this.inputDisposed
      && admission.registration.active && this.inputAdmission === admission.registration
      && this.inputCompletion === state
    if (state.result.status !== 'pending') return false
    if (!live()) {
      if (this.inputStop) await this.whenInputStopSettled()
      return fail('INPUT_COMPLETION_REVOKED')
    }
    try {
      const flushed = await this.ctx.sessions.flush(this.session)
      if (!live()) {
        if (this.inputStop) await this.whenInputStopSettled()
        return fail('INPUT_COMPLETION_REVOKED')
      }
      if (!flushed) return fail('INPUT_COMPLETION_FLUSH_FAILED')
      const receipt = admission.claim
        ? nativeCompletedInputReceipt(this.session, checkpoint, admission.claim, admission.supplement, end) : undefined
      const hook = admission.registration.hook
      if (!receipt || hook.schemaVersion !== 2 || !hook.completedWork) return fail('INPUT_COMPLETION_PROOF_INVALID')
      state.result = Object.freeze({status: 'pending', checkpoint, receipt})
      // Never use awaitInputOperation: the owner token is synchronously revoked
      // by onStop, but a commit already issued may still become durable.
      const acknowledgement = await hook.completedWork(receipt, signal)
      const checked = nativeCompletedInputAcknowledgement(acknowledgement, receipt)
      if (!live()) {
        if (this.inputStop) await this.whenInputStopSettled()
        return fail('INPUT_COMPLETION_REVOKED')
      }
      const current = nativeCompletedInputReceipt(this.session, checkpoint, admission.claim!, admission.supplement, end)
      if (!current || nativeInputSha256(current) !== nativeInputSha256(receipt)) return fail('INPUT_COMPLETION_PROOF_CHANGED')
      // The callback may have moved Source/head. Rechecking the old input
      // currency here would incorrectly reject its own successful commit.
      if (checked.status === 'none') return fail('INPUT_COMPLETION_ACK_INVALID')
      state.result = checked
      if (checked.status !== 'settled') {
        this.blockInput(admission.registration, checked.code ?? 'INPUT_COMPLETION_BLOCKED',
          'final', admission.proposal, admission.claim)
        return false
      }
      admission.registration.nominations?.clear()
      return true
    } catch {
      if (this.inputStop) await this.whenInputStopSettled()
      return fail(signal.aborted ? 'INPUT_COMPLETION_REVOKED' : 'INPUT_COMPLETION_OPERATION_FAILED')
    }
  }

  private materialRequestOwner(decision:Extract<PreparedStep,{kind:'enter'}>):MaterialRequestOwner|undefined {
    const admission=decision.admission
    if(admission?.registration.requestMaterial)return {kind:'player-input',admission,owner:admission.registration.requestMaterial}
    const opening=this.phase.kind==='running'?this.phase.programmatic?.opening:undefined
    return opening?{kind:'programmatic-opening',opening,owner:opening.registration.owner}:undefined
  }
  private assertMaterialRequestOwner(owner:MaterialRequestOwner,messages:readonly UserMessage[]):void {
    if(owner.kind==='player-input'){this.checkInput(owner.admission,messages);return}
    if(this.phase.kind!=='running'||this.phase.programmatic?.opening!==owner.opening||messages.length)
      throw Error('OPENING_NO_PLAYER_SELECTION_CHANGED')
    this.assertOpeningLive(owner.opening,this.phase.abort.signal)
  }
  private checkPreparedOpening(owner:Extract<MaterialRequestOwner,{kind:'programmatic-opening'}>,
    decision:Extract<PreparedStep,{kind:'enter'}>):void {
    this.assertMaterialRequestOwner(owner,decision.messages)
    const selected=this.#captureSelection(undefined,decision.messages),checked=nativeRequestMaterialOwnerCheckV1(owner.owner.check({
      owner:this.openingOwnerIdentity(owner.opening),phase:'prepared-precheckpoint',selected,
      assemblySha256:nativeInputSha256(decision.assembly)}))
    if(checked.kind!=='allow')this.abortMaterialRequestOwner(owner,checked.code)
    this.assertMaterialRequestOwner(owner,decision.messages)
    this.#assertSelectionCurrent()
  }
  private async checkpointOpening(decision:Extract<PreparedStep,{kind:'enter'}>,stepStart:SessionEvent<'step/start'>,
    signal:AbortSignal):Promise<void> {
    const owner=this.materialRequestOwner(decision)
    if(!owner||owner.kind!=='programmatic-opening')return
    this.checkPreparedOpening(owner,decision)
    const flushed=await this.ctx.sessions.flush(this.session)
    this.assertMaterialRequestOwner(owner,decision.messages)
    if(!flushed)this.abortMaterialRequestOwner(owner,'OPENING_CHECKPOINT_FLUSH_UNCONFIRMED')
    signal.throwIfAborted()
    this.checkPreparedOpening(owner,decision)
    if(!this.#materialSelection||this.#materialSelection.kind!=='programmatic-opening')
      this.abortMaterialRequestOwner(owner,'OPENING_CHECKPOINT_LINEAGE_CHANGED')
    this.#materialSelection.checkpointSha256=nativeInputSha256({schemaVersion:1,
      encoding:'native-programmatic-opening-checkpoint-v1',invocationRef:openingEventRefV1(owner.opening.invocation),
      stepStartRef:openingEventRefV1(stepStart),flushed:true})
  }
  private recordOpeningRequestAttempt(decision:Extract<PreparedStep,{kind:'enter'}>,
    position:{turn:number;step:number},firstAttempt:boolean):void {
    const owner=this.materialRequestOwner(decision)
    if(!owner||owner.kind!=='programmatic-opening')return
    this.assertMaterialRequestOwner(owner,decision.messages)
    const selected=this.#captureSelection(undefined,decision.messages,firstAttempt),attempt=(owner.opening.attempts.get(position.step)??0)+1
    owner.opening.attempts.set(position.step,attempt)
    const record=validateNativeOpeningRequestAttemptV1(sealNativeOpeningRecordV1({schemaVersion:1 as const,
      encoding:'native-programmatic-opening-request-attempt-v1' as const,invocationRef:openingEventRefV1(owner.opening.invocation),
      ...position,attempt,assemblySha256:nativeInputSha256(decision.assembly),selectedSha256:selected.sha256},'attemptSha256'))
    this.#recordSelectionAppend(()=>this.session.append('opening/request-attempt',record))
  }
  private abortMaterialRequestOwner(owner:MaterialRequestOwner,code:string):never {
    if(owner.kind==='player-input')this.abortInput(owner.admission,code,'final',owner.admission.claim)
    this.openingDomainCompletion={status:'blocked',code,invocationRef:openingEventRefV1(owner.opening.invocation)}
    throw Error(code)
  }
  #selectionCut():MaterialSelectionCut {
    const boundary=this.session.currentRequestBoundary()
    return {boundary,sha256:nativeInputSha256({boundarySeq:Number(boundary.boundarySeq),
      contentGeneration:boundary.contentGeneration,surfaceNodes:boundary.surfaceNodes,
      messages:boundary.messageNodes.map(({seq,message})=>({seq:Number(seq),id:String(message.id),
        role:message.role,messageSha256:nativeInputSha256(message)}))})}
  }

  #retireSelection():void {
    if(this.#materialSelection)this.#materialSelection.active=false
    this.#materialSelection=undefined
  }

  #failSelection(lineage:MaterialSelectionLineage,code:string):never {
    // A partial/unknown write cannot be adopted by a later successful cut.
    lineage.active=false
    throw Error(code)
  }

  #assertSelectionOwner(lineage:MaterialSelectionLineage):void {
    const {phase}=lineage
    if(!lineage.active||this.#materialSelection!==lineage||this.session!==lineage.session
      ||this.phase!==phase||phase.turn!==lineage.turn
      ||!(phase.step===lineage.step||phase.step+1===lineage.step&&lineage.stepStartSeq===undefined)
      ||this.inputDisposed){
      this.#failSelection(lineage,'REQUEST_MATERIAL_SELECTION_LINEAGE_REVOKED')
    }
    if(lineage.kind==='player-input') {
      const {admission}=lineage
      if(admission.registration!==lineage.registration||admission.identity!==lineage.identity
        ||admission.registration.requestMaterial!==lineage.owner
        ||!lineage.registration.active||this.inputAdmission!==lineage.registration
        ||admission.claim!==lineage.claim||nativeInputSha256(admission.claim)!==lineage.claimSha256)
        this.#failSelection(lineage,'REQUEST_MATERIAL_SELECTION_LINEAGE_REVOKED')
    }else {
      if(phase.programmatic?.opening!==lineage.opening||lineage.opening.registration!==lineage.registration
        ||this.openingMaterial!==lineage.registration||!lineage.registration.active
        ||lineage.registration.owner!==lineage.owner||lineage.pending.length)
        this.#failSelection(lineage,'REQUEST_MATERIAL_SELECTION_LINEAGE_REVOKED')
      this.assertOpeningLive(lineage.opening,phase.abort.signal)
    }
    phase.abort.signal.throwIfAborted()
  }

  #assertSelectionCurrent(lineage=this.#materialSelection):void {
    if(!lineage)return
    this.#assertSelectionOwner(lineage)
    if(this.#selectionCut().sha256!==lineage.expected.sha256){
      this.#failSelection(lineage,'REQUEST_MATERIAL_SELECTION_BOUNDARY_CHANGED')
    }
  }

  #assertSelectionDecision(lineage:MaterialSelectionLineage,admission:InputAdmission|undefined,
    messages:readonly UserMessage[]):void {
    this.#assertSelectionCurrent(lineage)
    if((lineage.kind==='player-input'?admission!==lineage.admission:admission!==undefined)
      ||messages.length!==lineage.pending.length
      ||messages.some((message,index)=>nativeInputSha256(message)!==lineage.pending[index]?.messageSha256)){
      this.#failSelection(lineage,'REQUEST_MATERIAL_SELECTION_PENDING_CHANGED')
    }
  }

  #captureSelection(admission:InputAdmission|undefined,messages:readonly UserMessage[],
    firstAttempt?:boolean):NativeMaterialSelectedBaseV1 {
    const lineage=this.#materialSelection
    if(!lineage)return this.#materialSelected(messages,firstAttempt??false)
    this.#assertSelectionDecision(lineage,admission,messages)
    if(firstAttempt!==undefined&&firstAttempt===lineage.attemptStarted){
      this.#failSelection(lineage,'REQUEST_MATERIAL_SELECTION_ATTEMPT_CHANGED')
    }
    const pending=lineage.pending.slice(lineage.pendingCursor).map(row=>{
      if(row.message.role!=='user')return this.#failSelection(lineage,'REQUEST_MATERIAL_SELECTION_PENDING_INVALID')
      return row.message
    })
    const selected=this.#materialSelected(pending,true)
    this.#assertSelectionCurrent(lineage)
    nativeMaterialSelections.set(selected,{lineage,revision:lineage.revision,
      pendingCursor:lineage.pendingCursor,boundarySha256:lineage.expected.sha256})
    return selected
  }

  #recordSelectionAppend<E extends SessionEvent>(append:()=>E,pendingMessage?:UserMessage):E {
    const lineage=this.#materialSelection
    if(!lineage)return append()
    this.#assertSelectionCurrent(lineage)
    const before=lineage.expected
    const pending=pendingMessage===undefined?undefined:lineage.pending[lineage.pendingCursor]
    if(pendingMessage!==undefined&&(!pending||nativeInputSha256(pendingMessage)!==pending.messageSha256)){
      this.#failSelection(lineage,'REQUEST_MATERIAL_SELECTION_PENDING_APPEND_CHANGED')
    }
    let event:E
    try{event=append()}
    catch(error){lineage.active=false;throw error}
    if(lineage.kind==='programmatic-opening') {
      if(!openingSelectionAppendTypes.has(event.type)||pendingMessage!==undefined)
        this.#failSelection(lineage,'OPENING_SELECTION_FOREIGN_APPEND')
      if(event.type==='opening/request-attempt') {
        const attempt=validateNativeOpeningRequestAttemptV1(event.data)
        if(attempt.turn!==lineage.turn||attempt.step!==lineage.step
          ||nativeInputSha256(attempt.invocationRef)!==nativeInputSha256(openingEventRefV1(lineage.opening.invocation))
          ||attempt.attempt!==lineage.opening.attempts.get(lineage.step))
          this.#failSelection(lineage,'OPENING_SELECTION_ATTEMPT_OWNER_CHANGED')
      }
    }
    const after=this.#selectionCut()
    // Publication can synchronously notify arbitrary observers. Only the
    // actual append's returned event may be the new latest log boundary.
    if(Number(event.seq)!==Number(before.boundary.boundarySeq)+1||after.boundary.boundarySeq!==event.seq){
      this.#failSelection(lineage,'REQUEST_MATERIAL_SELECTION_APPEND_BOUNDARY_CHANGED')
    }
    this.#assertSelectionOwner(lineage)
    if(pending){
      if(event.type!=='user/message'||nativeInputSha256(event.data)!==pending.messageSha256){
        this.#failSelection(lineage,'REQUEST_MATERIAL_SELECTION_ADMITTED_MESSAGE_CHANGED')
      }
      const admitted=after.boundary.messageNodes.find(row=>row.seq===event.seq)
      if(!admitted||nativeInputSha256(admitted.message)!==pending.messageSha256){
        this.#failSelection(lineage,'REQUEST_MATERIAL_SELECTION_ADMITTED_SURFACE_CHANGED')
      }
      lineage.pendingCursor++
    }
    const eventSha256=nativeInputSha256(event)
    lineage.events.push(Object.freeze({kind:'native-append',seq:Number(event.seq),type:event.type,
      sha256:eventSha256,beforeBoundarySha256:before.sha256,afterBoundarySha256:after.sha256,
      ...pending?{admitted:Object.freeze({pendingIndex:lineage.pendingCursor-1,id:pending.id,
        role:'user' as const,messageSha256:pending.messageSha256})}:{}}))
    lineage.actualEvents.push(event)
    lineage.expected=after
    lineage.revision++
    if(event.type==='step/start')lineage.stepStartSeq=Number(event.seq)
    const actualEvent:SessionEvent=event
    if(actualEvent.type==='assistant/attempt')lineage.lastAttempt={event:actualEvent,sha256:eventSha256}
    return event
  }

  #recoveryCut(failure:{readonly code:string;readonly offloadImages?:number}):MaterialRecoveryCut|undefined {
    const lineage=this.#materialSelection
    if(!lineage)return undefined
    this.#assertSelectionCurrent(lineage)
    if(!lineage.attemptStarted||lineage.pendingCursor!==lineage.pending.length||!lineage.lastAttempt
      ||lineage.lastAttempt.event.seq!==lineage.expected.boundary.boundarySeq){
      this.#failSelection(lineage,'REQUEST_MATERIAL_SELECTION_RETRY_ATTEMPT_CHANGED')
    }
    // One explicit read cut around this actual failure waterfall. The Session
    // owns its frozen log and projections; no detached fold is reimplemented.
    // oxlint-disable-next-line typescript/no-deprecated -- Native's exact recovery window requires actual event refs.
    const events=this.session.snapshotEvents()
    if(events.length!==Number(lineage.expected.boundary.boundarySeq)+1
      ||events.at(-1)!==lineage.lastAttempt.event
      ||nativeInputSha256(lineage.lastAttempt.event)!==lineage.lastAttempt.sha256){
      this.#failSelection(lineage,'REQUEST_MATERIAL_SELECTION_RETRY_LOG_CHANGED')
    }
    const basic={lineage,before:lineage.expected,events,failureSha256:nativeInputSha256(failure)}
    if(failure.code!==IMAGE_OFFLOAD_REQUIRED_CODE)return basic
    const count=failure.offloadImages
    if(typeof count!=='number'||!Number.isSafeInteger(count)||count<=0){
      this.#failSelection(lineage,'REQUEST_MATERIAL_IMAGE_OFFLOAD_COUNT_INVALID')
    }
    let remaining=count
    const targets:{seq:number;imageIndexes:readonly number[]}[]=[]
    for(const {seq,message} of lineage.expected.boundary.messageNodes){
      if(remaining===0)break
      const event=events[Number(seq)]
      if(event?.type!=='user/message'&&event?.type!=='tool/result')continue
      let imageIndex=0
      const imageIndexes:number[]=[]
      for(const block of message.content){
        if(block.type!=='image')continue
        if(block.offloaded!==true&&remaining>0){imageIndexes.push(imageIndex);remaining--}
        imageIndex++
      }
      if(imageIndexes.length)targets.push(Object.freeze({seq:Number(seq),imageIndexes:Object.freeze(imageIndexes)}))
    }
    if(remaining!==0)this.#failSelection(lineage,'REQUEST_MATERIAL_IMAGE_OFFLOAD_COUNT_EXCEEDS_RETAINED')
    return {...basic,offloadImages:count,targets:Object.freeze(targets)}
  }

  #acceptRecovery(cut:MaterialRecoveryCut|undefined):void {
    if(!cut)return
    const {lineage,before}=cut
    this.#assertSelectionOwner(lineage)
    if(lineage.expected!==before)this.#failSelection(lineage,'REQUEST_MATERIAL_SELECTION_RETRY_CUT_CHANGED')
    const after=this.#selectionCut()
    if(cut.offloadImages===undefined){
      if(after.sha256!==before.sha256)this.#failSelection(lineage,'REQUEST_MATERIAL_SELECTION_RETRY_FOREIGN_APPEND')
      return
    }
    // oxlint-disable-next-line typescript/no-deprecated -- Inspect only the actual recovery tail against the captured frozen prefix.
    const events=this.session.snapshotEvents()
    const event=events[cut.events.length]
    if(!event||events.length!==cut.events.length+1||cut.events.some((prior,index)=>events[index]!==prior)
      ||Number(event.seq)!==cut.events.length||after.boundary.boundarySeq!==event.seq
      ||String(event.type)!=='image/offload'||Reflect.ownKeys(event).some(key=>
        typeof key!=='string'||!['type','seq','time','data'].includes(key))
      ||nativeInputSha256(event.data)!==nativeInputSha256({targets:cut.targets})
      ||after.boundary.contentGeneration!==before.boundary.contentGeneration+1
      ||nativeInputSha256(after.boundary.surfaceNodes)!==nativeInputSha256(before.boundary.surfaceNodes)
      ||after.boundary.messageNodes.length!==before.boundary.messageNodes.length){
      this.#failSelection(lineage,'REQUEST_MATERIAL_IMAGE_OFFLOAD_RECOVERY_CHANGED')
    }
    const targets=new Map(cut.targets?.map(target=>[target.seq,new Set(target.imageIndexes)]))
    for(const [index,row] of before.boundary.messageNodes.entries()){
      const actual=after.boundary.messageNodes[index]
      const indexes=targets.get(Number(row.seq))
      let imageIndex=0
      const expected=indexes?{...row.message,content:row.message.content.map(block=>{
        if(block.type!=='image')return block
        const selected=indexes.has(imageIndex++)
        return selected?{...block,offloaded:true as const}:block
      })}:row.message
      if(!actual||actual.seq!==row.seq||nativeInputSha256(actual.message)!==nativeInputSha256(expected)){
        this.#failSelection(lineage,'REQUEST_MATERIAL_IMAGE_OFFLOAD_MESSAGE_CHANGED')
      }
    }
    // This certifies the precise effect during Native's failure window, not
    // which plugin handler ran. An identical authorized effect is equivalent.
    lineage.events.push(Object.freeze({kind:'image-offload-recovery',seq:Number(event.seq),type:String(event.type),
      sha256:nativeInputSha256(event),beforeBoundarySha256:before.sha256,afterBoundarySha256:after.sha256,
      failureSha256:cut.failureSha256,offloadImages:cut.offloadImages,targets:cut.targets}))
    lineage.actualEvents.push(event)
    lineage.expected=after
    lineage.revision++
  }

  /** Prepare belongs to this final decision before step/start. Only a fully
   * checked prepared result starts a new private selection lineage. */
  async #prepareRequestMaterial(decision:Extract<PreparedStep,{kind:'enter'}>,
    position:{turn:number;step:number},signal:AbortSignal):Promise<void> {
    this.#retireSelection()
    const requestOwner=this.materialRequestOwner(decision)
    if(!requestOwner||!requestOwner.owner.prepare)return
    this.assertMaterialRequestOwner(requestOwner,decision.messages)
    const selected=this.#materialSelected(decision.messages,true)
    const finalAssembly=deepFreeze(structuredClone(decision.assembly))
    const assemblySha256=nativeInputSha256(finalAssembly)
    const common={schemaVersion:1 as const,...position,signal,finalAssembly,assemblySha256,selected}
    let result:ReturnType<typeof nativeRequestMaterialPrepareDecisionV1>
    try {
      if(requestOwner.kind==='player-input') {
        const preparation:NativeRequestMaterialPrepareInputV1=Object.freeze({...common,
          admission:this.materialAdmission(requestOwner.admission,decision.messages)})
        result=nativeRequestMaterialPrepareDecisionV1(await requestOwner.owner.prepare!(preparation))
      }else {
        const preparation:NativeOpeningMaterialPrepareInputV1=Object.freeze({...common,
          owner:this.openingOwnerIdentity(requestOwner.opening),noPlayer:Object.freeze({kind:'no-player',
            selectedUserMessageIds:Object.freeze([]) as readonly []})})
        result=nativeRequestMaterialPrepareDecisionV1(await requestOwner.owner.prepare(preparation))
      }
    }
    catch(error) {
      const code=error instanceof Error&&/^[A-Z][A-Z0-9_]{0,95}$/.test(error.message)
        ?error.message:'REQUEST_MATERIAL_PREPARATION_FAILED'
      this.abortMaterialRequestOwner(requestOwner,code)
    }
    signal.throwIfAborted()
    this.assertMaterialRequestOwner(requestOwner,decision.messages)
    // Preparation may write Core data, but the exact Native request cut and
    // complete assembly cannot change before step/start and checkpoint.
    if(this.#materialSelected(decision.messages,true).sha256!==selected.sha256) {
      this.abortMaterialRequestOwner(requestOwner,'REQUEST_MATERIAL_PREPARATION_BASE_CHANGED')
    }
    if(nativeInputSha256(decision.assembly)!==assemblySha256) {
      this.abortMaterialRequestOwner(requestOwner,'REQUEST_MATERIAL_PREPARATION_ASSEMBLY_CHANGED')
    }
    if(result.kind==='blocked')this.abortMaterialRequestOwner(requestOwner,result.code)
    if(result.kind!=='prepared') {
      if(requestOwner.kind==='programmatic-opening')this.abortMaterialRequestOwner(requestOwner,'OPENING_MATERIAL_PREPARATION_REQUIRED')
      return
    }
    if(this.phase.kind!=='running'||requestOwner.kind==='player-input'&&!requestOwner.admission.claim){
      this.abortMaterialRequestOwner(requestOwner,'REQUEST_MATERIAL_SELECTION_OWNER_CHANGED')
    }
    const shared={session:this.session,phase:this.phase,...position,initial:selected,
      pending:Object.freeze(selected.messages.filter(row=>row.origin==='pending-decision')),
      expected:this.#selectionCut(),active:true,revision:0,pendingCursor:0,attemptStarted:false,
      events:[] as NativeMaterialSelectionEventV1[],actualEvents:[] as SessionEvent[],
      assertCurrent:()=>this.#assertSelectionCurrent(lineage)}
    const lineage:MaterialSelectionLineage=requestOwner.kind==='player-input'
      ?{...shared,kind:'player-input',admission:requestOwner.admission,registration:requestOwner.admission.registration,
        identity:requestOwner.admission.identity,owner:requestOwner.owner,claim:requestOwner.admission.claim!,
        claimSha256:nativeInputSha256(requestOwner.admission.claim)}
      :{...shared,kind:'programmatic-opening',opening:requestOwner.opening,
        registration:requestOwner.opening.registration,owner:requestOwner.owner}
    this.#materialSelection=lineage
    nativeMaterialSelections.set(selected,{lineage,revision:0,pendingCursor:0,boundarySha256:lineage.expected.sha256})
    if(requestOwner.kind==='programmatic-opening')this.checkPreparedOpening(requestOwner,decision)
  }

  private async turn(): Promise<boolean> {
    if (this.phase.kind !== 'running') {
      this.throwError(new Error(`agent "${this.id}": turn without driver reservation`))
    }
    const phase = this.phase
    const { signal } = phase.abort
    if (this.inputCompletionBlocked || this.openingCompletionBlocked && !phase.programmatic?.opening) return false
    signal.throwIfAborted()
    const requiresAdmission = this.inputAdmission !== undefined && !phase.programmatic
    const initial = requiresAdmission ? await this.admitInput('next-turn') : undefined
    if (requiresAdmission && initial?.kind !== 'admitted') return false
    const initialAdmission = initial?.kind === 'admitted' ? initial.admission : undefined
    const requiresCompletion = initialAdmission?.completedWorkRequired === true
    signal.throwIfAborted()
    if (initialAdmission && (!initialAdmission.registration.active || this.inputAdmission !== initialAdmission.registration
      || !this.inbox.matches(initialAdmission.proposal))) {
      this.blockInput(initialAdmission.registration, 'INPUT_PROPOSAL_CHANGED', 'proposal', initialAdmission.proposal)
      return false
    }
    const turn = phase.turn + 1
    try {
      const start = this.session.append('turn/start', {turn,
        ...(initialAdmission?.marker ? {nativeInputLink: initialAdmission.marker} : {})})
      if (initialAdmission?.marker) initialAdmission.startSeq = start.seq
    } catch (error: unknown) {
      this.throwError(error)
    }
    phase.turn = turn
    let turnEnds: TurnEndReason | null = null
    let target: InboxTarget = 'next-turn'
    let currentAdmission = initialAdmission
    let capturedEnd: SessionEvent | undefined
    try {
      while (true) {
        signal.throwIfAborted()
        const step = phase.step + 1
        const decision = await this.preStep(target, { turn, step }, step === 1 ? initialAdmission : undefined, currentAdmission)
        if (decision.kind === 'reject') {
          turnEnds = { kind: 'blocked' }
          return false
        }
        currentAdmission = decision.admission
        if (turnEnds && decision.messages.length === 0) break
        // A removed waking message or an enter decision rewritten to empty
        // still owns the initial turn boundary, but it spends no model call.
        if (phase.step === 0 && decision.messages.length === 0 && !phase.programmatic) {
          turnEnds = { kind: 'completed' }
          return false
        }
        signal.throwIfAborted()
        // Empty/no-request exits above spend no material work or records. The
        // existing Core step and final decision are retained; hooks do not rerun.
        if(!phase.programmatic||phase.programmatic.opening)await this.#prepareRequestMaterial(decision,{turn,step},signal)
        signal.throwIfAborted()
        const stepStart = this.#recordSelectionAppend(()=>this.session.append('step/start', { turn, step }))
        phase.step = step
        try {
          if (step === 1 && decision.admission) await this.checkpointInput(decision.admission, stepStart.seq, decision.messages)
          if(phase.programmatic?.opening)await this.checkpointOpening(decision,stepStart,signal)
          this.#assertSelectionCurrent()
          if(this.#materialSelection&&decision.admission?.receipt){
            this.#materialSelection.checkpointSha256=nativeInputSha256(decision.admission.receipt)
          }
          // max-tokens is sticky: once any step hits the ceiling, later steps
          // that complete normally must not downgrade the turn outcome.
          const stepEnd = await this.step(decision)
          // max-tokens stays sticky: a later completed step must not
          // downgrade the turn outcome.
          if (turnEnds === null || turnEnds.kind !== 'max-tokens') turnEnds = stepEnd
        } finally {
          this.#retireSelection()
          this.session.append('step/end', { turn, step })
        }
        signal.throwIfAborted()
        if (turnEnds && this.inbox.nextStep.length === 0) {
          await this.dispatch.serial('agent/turn-stopping', { turn, signal })
          signal.throwIfAborted()
        }
        if (turnEnds && this.inbox.nextStep.length === 0) break
        target = 'next-step'
      }
      // Source/base currency remains immutable through all maintenance. After
      // the closing publisher moves it, only its terminal receipt is checked.
      if (requiresCompletion && currentAdmission) this.checkInput(currentAdmission, [])
    } catch (error: unknown) {
      // A cause is present exactly while the signal is aborted.
      const cause = abortedCancelCause(signal)
      if (cause !== undefined) {
        turnEnds = { kind: 'aborted', reason: cause }
        throw error
      }
      // Every failure is structured: an `LlmError` keeps its facts, anything
      // else flattens to `errorChain` text under the `UNKNOWN` code.
      turnEnds = {
        kind: 'error',
        error: error instanceof LlmError
          ? error.failure
          : { message: errorChain(error), code: 'UNKNOWN' },
      }
      this.throwError(error)
    } finally {
      this.#retireSelection()
      if(phase.programmatic?.opening&&turnEnds?.kind!=='completed')this.openingDomainCompletion={
        status:'blocked',code:'OPENING_GENERATION_TURN_NOT_COMPLETED',
        invocationRef:openingEventRefV1(phase.programmatic.opening.invocation)}
      if (requiresCompletion && currentAdmission?.receipt) {
        this.inputCompletion = {registration: currentAdmission.registration,
          result: Object.freeze({status: turnEnds?.kind === 'completed' ? 'pending' : 'blocked',
            checkpoint: currentAdmission.receipt,
            ...(turnEnds?.kind === 'completed' ? {} : {code: 'INPUT_COMPLETION_TURN_NOT_COMPLETED'})})}
        if (turnEnds?.kind !== 'completed') this.blockInput(currentAdmission.registration,
          'INPUT_COMPLETION_TURN_NOT_COMPLETED', 'final', currentAdmission.proposal, currentAdmission.claim)
      } else {
        if (requiresCompletion) {
          // No first checkpoint cannot be repaired by replaying a new turn.
          this.programmaticTurnPoisoned = true
        }
        currentAdmission?.registration.nominations?.clear()
      }
      try {
        // oxlint-disable-next-line typescript/no-non-null-assertion -- every exit assigns a turn ending
        capturedEnd = this.session.append('turn/end', { turn, reason: turnEnds! })
      } catch (error: unknown) {
        if (this.inputCompletionBlocked && this.inputCompletion) this.inputCompletion.result = Object.freeze({
          status: 'unknown', checkpoint: this.inputCompletion.result.checkpoint, code: 'INPUT_COMPLETION_END_UNKNOWN'})
        if (requiresCompletion && currentAdmission) this.blockInput(currentAdmission.registration,
          'INPUT_COMPLETION_END_UNKNOWN', 'final', currentAdmission.proposal, currentAdmission.claim)
        this.throwError(error)
      }
    }
    // Outside the turn's try/finally: a failed terminal operation must never
    // append a second end or relabel the already-completed turn as aborted.
    if (requiresCompletion && currentAdmission
      && !await this.completeInputWork(currentAdmission, capturedEnd!, signal)) return false
    if(phase.programmatic?.opening&&!await this.closeOwnedOpening(phase.programmatic.opening,signal))return false
    if (phase.programmatic || !this.inbox.hasPending) return false
    phase.abort = new AbortController()
    // A fresh controller makes a latch set on the old one stale: the live driver claims the queue itself.
    phase.wakeRequested = false
    phase.step = 0
    return true
  }

  private async step(decision: Extract<PreparedStep, { kind: 'enter' }>): Promise<StepEndReason | null> {
    /* v8 ignore next -- private callers establish the running phase before executing a step */
    if (this.phase.kind !== 'running') throw new Error(`agent "${this.id}": step outside running phase`)
    const { turn, step, abort: { signal } } = this.phase
    signal.throwIfAborted()

    const { assembly } = decision
    const renderedPrompt = renderPrompt(assembly)
    let firstAttempt = true
    while (true) {
      this.recordOpeningRequestAttempt(decision,{turn,step},firstAttempt)
      const { config, preparedCall } = await this.prepareRequest(turn, step, signal)
      // Adapter preparation can await arbitrary work. Recheck before every
      // system/user/header commit and provider stream, including retries.
      const admission = decision.admission
      if (admission) this.checkInput(admission, decision.messages)
      const startsRequestSeries = firstAttempt && decision.startsRequestSeries === true
      let request=this.materialRequestOwner(decision)
        ?this.buildMaterialRequest(decision,{config,preparedCall,turn,step,firstAttempt,signal}):undefined
      if(request===undefined){
        const commits = this.systemPrompt.project(renderedPrompt, {
          inHistory: preparedCall?.systemPromptUpdate === 'in-history',
          startsSeries: startsRequestSeries
            || this.requestSurfaceGeneration !== this.session.surface.contentGeneration
            || (preparedCall?.toolUpdate === undefined && this.toolsChanged(assembly.tools)),
        })
        for (const { message, intent } of commits) {
          this.#recordSelectionAppend(()=>this.session.append('system/message', { turn, step, message }, intent))
        }
        if (firstAttempt) {
          for (const message of decision.messages) {
            this.#recordSelectionAppend(()=>this.session.append('user/message', message, { surfaceOp: 'append' }),message)
          }
        }
        firstAttempt=false
        request=this.buildRequest(config,preparedCall,assembly.tools,{turn,step},startsRequestSeries,signal)
      }else{
        firstAttempt=false
      }
      if(this.#materialSelection){
        this.#assertSelectionCurrent()
        if(this.#materialSelection.pendingCursor!==this.#materialSelection.pending.length){
          this.#failSelection(this.#materialSelection,'REQUEST_MATERIAL_SELECTION_PENDING_NOT_ADMITTED')
        }
        this.#materialSelection.attemptStarted=true
      }
      // Session append notifications can synchronously invalidate Source or
      // readiness. The already-written input is admitted, never replayable.
      if (admission) this.checkInput(admission, decision.messages)
      const live = new AssistantStreamAttempt(
        this.session.id,
        ++this.assistantAttemptCounter,
        () => ++this.assistantStreamRevision,
        turn,
        step,
        (frame) => { this.dispatch.emit('agent/assistant-stream', { frame }) },
      )
      let started = false
      try {
        if (admission) signal.throwIfAborted()
        const stream = preparedCall?.stream(request) ?? this.loopCtx.llm.stream(request)
        signal.throwIfAborted()
        live.start()
        started = true
        for await (const chunk of stream) {
          signal.throwIfAborted()
          live.push(chunk)
        }
        signal.throwIfAborted()
      } catch (error: unknown) {
        if (!started) throw error
        // Thrown/aborted streams have no recovery reentry. Retire proof before
        // the established interrupted/attempt settlement, including aborted signals.
        this.#retireSelection()
        try {
          if (signal.aborted) {
            const content = live.interruptedBlocks()
            if (content.length > 0) {
              live.settle('assistant/message', () => this.session.append('assistant/message', {
                turn,
                step,
                message: createAssistantMessage({
                  content,
                  source: {
                    provider: request.provider,
                    model: request.model,
                    ...live.replayState === undefined ? {} : { replayState: live.replayState },
                  },
                }),
                interrupted: true,
                ...live.usage === undefined ? {} : { usage: live.usage },
                stream: live.stream,
              }, { surfaceOp: 'append' }).seq)
            } else {
              live.settle(
                'assistant/attempt',
                () => this.session.append('assistant/attempt', { turn, step, stream: live.stream }).seq,
              )
            }
          } else {
            live.settle(
              'assistant/attempt',
              () => this.session.append('assistant/attempt', { turn, step, stream: live.stream }).seq,
            )
          }
        } catch (settlementError: unknown) {
          throw new AggregateError(
            [error, settlementError],
            'Assistant stream failed and its durable settlement was rejected',
            { cause: error },
          )
        }
        throw error
      }
      try {
        const finish = live.finish
        if (finish.kind === 'error' || finish.kind === 'aborted') {
          live.settle(
            'assistant/attempt',
            () => this.#recordSelectionAppend(()=>this.session.append('assistant/attempt', { turn, step, stream: live.stream })).seq,
          )
          const recovery=this.#recoveryCut(finish.failure)
          const action = await this.dispatch.waterfall(
            'agent/request-error', {
              turn,
              step,
              provider: request.provider,
              failure: finish.failure,
              retryPolicy: preparedCall?.retryPolicy,
              signal,
            },
            () => Promise.resolve<RequestErrorAction>(undefined),
          )
          signal.throwIfAborted()
          if (action?.kind !== 'retry') {
            throw new LlmError(finish.failure.message, finish.failure.code, finish.failure)
          }
          this.#acceptRecovery(recovery)
          continue
        }

        this.#assertSelectionCurrent()
        // A successful model message closes this request lineage. Tool output
        // and the next step are admitted under their own fresh preparation.
        this.#retireSelection()

        const createdMessage = createAssistantMessage({
          content: live.blocks(),
          source: {
            provider: request.provider,
            model: request.model,
            ...live.replayState !== undefined ? { replayState: live.replayState } : {},
          },
        })
        const message = this.phase.programmatic && step === 1
          ? freezeMessage({...createdMessage, id: brandString<AssistantMessage['id']>(this.phase.programmatic.messageId)})
          : createdMessage
        live.settle(
          'assistant/message',
          () => this.session.append('assistant/message', {
            turn,
            step,
            message,
            ...live.usage === undefined ? {} : { usage: live.usage },
            stream: live.stream,
          }, { surfaceOp: 'append' }).seq,
        )
        if (finish.kind === 'max-tokens') return { kind: 'max-tokens' }

        const toolCalls = message.content.filter(block => block.type === 'tool-call')
        if (toolCalls.length === 0) return { kind: 'completed' }
        const { concluded } = await executeToolCalls(
          this.loopCtx, turn, step, toolCalls, signal,
          context => this.inbox.splice('next-step', this.inbox.nextStep.length, 0, [context]),
        )
        return concluded ? { kind: 'completed' } : null
      } catch (error: unknown) {
        if (!live.ended) live.abandon()
        throw error
      }
    }
  }

  /** Resolve request config and bind its adapter before admitting model-visible input. */
  private async prepareRequest(
    turn: number,
    step: number,
    signal: AbortSignal,
  ): Promise<{ config: LlmCallConfig; preparedCall?: PreparedLlmCall }> {
    const { session } = this

    // A loop instance starts from its declared route, restoring only an explicit
    // effort owned by that exact model. Later steps re-resolve marked defaults.
    const persistedHeader = session.requestHeader()
    const persistedConfig = persistedHeader?.config
    const route = { provider: this.options.provider ?? '', model: this.options.model ?? '' }
    const persistedReasoningEffort = persistedConfig?.provider === route.provider
      && persistedConfig.model === route.model
      && persistedHeader?.adapterDefaults?.reasoningEffort !== true
      ? persistedConfig.reasoningEffort
      : undefined
    const reasoningEffort = this.options.reasoningEffort ?? persistedReasoningEffort
    const maxTokens = this.options.maxTokens
    const seedConfig = deepFreeze(structuredClone(
      this.requestHeaderLogged
        // oxlint-disable-next-line typescript/no-non-null-assertion -- the instance logged the header it now folds
        ? requestProposal(persistedHeader!)
        : {
          ...route,
          ...reasoningEffort === undefined ? {} : { reasoningEffort },
          ...maxTokens === undefined ? {} : { maxTokens },
        },
    ))
    const proposedConfig = await this.dispatch.waterfall(
      'agent/request', { turn, step, signal },
      () => Promise.resolve(seedConfig),
    )
    signal.throwIfAborted()
    if (!proposedConfig.provider || !proposedConfig.model) {
      throw new Error(`agent "${this.id}" has no provider/model: set AgentOptions.provider and AgentOptions.model or supply both via the agent/request waterfall`)
    }
    let config: LlmCallConfig
    let preparedCall: PreparedLlmCall | undefined
    try {
      preparedCall = await this.loopCtx.llm.prepareCall(proposedConfig, signal)
      config = preparedCall.config
    } catch (error: unknown) {
      // Middleware may serve an unregistered route; terminal dispatch still requires an adapter.
      if (!(error instanceof LlmError) || error.code !== 'NO_ADAPTER') throw error
      config = proposedConfig
    }
    signal.throwIfAborted()
    return { config, ...preparedCall === undefined ? {} : { preparedCall } }
  }

  /** Actual v2 input objects for the same registered material owner. */
  private materialAdmission(admission:InputAdmission,messages:readonly UserMessage[]):NativeInputAdmissionCheckV2 {
    if(admission.registration.hook.schemaVersion!==2||!admission.preparation||!admission.claim){
      this.abortInput(admission,'REQUEST_MATERIAL_V2_OWNER_REQUIRED','final',admission.claim)
    }
    return Object.freeze({proposal:admission.proposal,claim:admission.claim,identity:admission.identity,messages,
      preparation:admission.preparation,...admission.continuation?{continuation:true as const}:{},
      ...admission.receipt?{receipt:admission.receipt}:{},...admission.supplement?{supplement:admission.supplement}:{}})
  }

  /** The selected data precedes planned system/header/tool operations. It
   * distinguishes actual surface nodes from not-yet-appended decision input. */
  #materialSelected(messages:readonly UserMessage[],firstAttempt:boolean):NativeMaterialSelectedBaseV1 {
    const boundary=this.session.currentRequestBoundary()
    const selected=[...boundary.messageNodes.map(({seq,message})=>Object.freeze({origin:'surface' as const,
      eventSeq:Number(seq),id:String(message.id),role:message.role,messageSha256:nativeInputSha256(message),message})),
      ...firstAttempt?messages.map(original=>{const message=freezeMessage(original)
        return Object.freeze({origin:'pending-decision' as const,eventSeq:null,id:String(message.id),role:message.role,
          messageSha256:nativeInputSha256(message),message})}):[]]
    const data={contentGeneration:boundary.contentGeneration,boundarySeq:Number(boundary.boundarySeq),
      surfaceNodes:Object.freeze([...boundary.surfaceNodes]),messages:Object.freeze(selected)}
    // Message refs bind content as well as membership; plain append does not
    // increase contentGeneration, so that counter alone cannot certify a cut.
    return Object.freeze({...data,sha256:nativeInputSha256({...data,
      messages:selected.map(({message:_message,...ref})=>ref)})})
  }

  private checkMaterialOwner(requestOwner:MaterialRequestOwner,messages:readonly UserMessage[],
    decision:NativeRequestMaterialTransformV1,phase:'planned-precommit'|'committed-predispatch',
    materialRef?:{seq:number;sha256:string}):void {
    this.assertMaterialRequestOwner(requestOwner,messages)
    const admission=requestOwner.kind==='player-input'?requestOwner.admission:undefined
    const selected=this.#materialSelection?this.#captureSelection(admission,messages):undefined
    let result:ReturnType<NativeRequestMaterialOwnerV1['check']>
    try {
      if(requestOwner.kind==='player-input')result=nativeRequestMaterialOwnerCheckV1(requestOwner.owner.check({
        admission:this.materialAdmission(requestOwner.admission,messages),phase,decision,
        ...selected?{selected}:{},...materialRef?{materialRef}:{}}))
      else {
        if(!selected)this.abortMaterialRequestOwner(requestOwner,'OPENING_NATIVE_SELECTION_REQUIRED')
        result=nativeRequestMaterialOwnerCheckV1(requestOwner.owner.check({owner:this.openingOwnerIdentity(requestOwner.opening),
          phase,decision,selected,...materialRef?{materialRef}:{}}))
      }
    }
    catch {this.abortMaterialRequestOwner(requestOwner,'REQUEST_MATERIAL_OWNER_CHECK_FAILED')}
    if(result.kind!=='allow')this.abortMaterialRequestOwner(requestOwner,result.code)
    this.assertMaterialRequestOwner(requestOwner,messages)
    this.#assertSelectionCurrent()
  }

  /** One synchronous transform per actual request retry. All refusals and
   * planning finish before the first system/user/header/context commit. */
  private buildMaterialRequest(decision:Extract<PreparedStep,{kind:'enter'}>,input:{config:LlmCallConfig;
    preparedCall:PreparedLlmCall|undefined;turn:number;step:number;firstAttempt:boolean;signal:AbortSignal}):
    GenerateOptions|undefined {
    const requestOwner=this.materialRequestOwner(decision)
    if(!requestOwner)return undefined
    const admission=requestOwner.kind==='player-input'?requestOwner.admission:undefined,owner=requestOwner.owner
    const {config,preparedCall,turn,step,firstAttempt,signal}=input
    signal.throwIfAborted()
    const selected=this.#captureSelection(admission,decision.messages,firstAttempt)
    const finalAssembly=deepFreeze(structuredClone(decision.assembly))
    const common={schemaVersion:1 as const,turn,step,firstAttempt,signal,
      preparedRoute:Object.freeze({configSha256:nativeInputSha256(config),
        ...preparedCall?.requestMaterialText?{requestMaterialText:preparedCall.requestMaterialText}:{},
        ...preparedCall?.systemPromptUpdate?{systemPromptUpdate:preparedCall.systemPromptUpdate}:{},
        ...preparedCall?.toolUpdate?{toolUpdate:preparedCall.toolUpdate}:{}}),
      finalAssembly,assemblySha256:nativeInputSha256(finalAssembly),selected}
    let materialDecision:ReturnType<typeof nativeRequestMaterialDecisionV1>
    try {
      if(requestOwner.kind==='player-input') {
        const payload:NativeRequestMaterialInputV1=Object.freeze({...common,
          admission:this.materialAdmission(requestOwner.admission,decision.messages)})
        materialDecision=nativeRequestMaterialDecisionV1(requestOwner.owner.transform(payload))
      }else {
        const attempt=requestOwner.opening.attempts.get(step)
        if(attempt===undefined)this.abortMaterialRequestOwner(requestOwner,'OPENING_REQUEST_ATTEMPT_REQUIRED')
        const payload:NativeOpeningMaterialInputV1=Object.freeze({...common,attempt,
          owner:this.openingOwnerIdentity(requestOwner.opening),noPlayer:Object.freeze({kind:'no-player',
            selectedUserMessageIds:Object.freeze([]) as readonly []})})
        materialDecision=nativeRequestMaterialDecisionV1(requestOwner.owner.transform(payload))
      }
    }
    catch {this.abortMaterialRequestOwner(requestOwner,'REQUEST_MATERIAL_TRANSFORM_FAILED')}
    this.assertMaterialRequestOwner(requestOwner,decision.messages)
    if(this.#materialSelected(decision.messages,firstAttempt).sha256!==selected.sha256){
      this.abortMaterialRequestOwner(requestOwner,'REQUEST_MATERIAL_SELECTED_BASE_CHANGED')
    }
    if(materialDecision.kind==='blocked')this.abortMaterialRequestOwner(requestOwner,materialDecision.code)
    if(materialDecision.kind==='unchanged') {
      if(requestOwner.kind==='programmatic-opening')this.abortMaterialRequestOwner(requestOwner,'OPENING_MATERIAL_TRANSFORM_REQUIRED')
      return undefined
    }
    const plan=materialDecision
    if(plan.expectedAssemblySha256!==common.assemblySha256||plan.expectedSelectedBaseSha256!==selected.sha256){
      this.abortMaterialRequestOwner(requestOwner,'REQUEST_MATERIAL_PRECONDITION_CHANGED')
    }
    // A route's system replacement bit is not additive system-at-depth support.
    // Missing exact-route capability refuses each required insertion before writes.
    const capability=preparedCall?.requestMaterialText
    if(capability?.schemaVersion!==1||![capability.user,capability.assistant,capability.systemAtDepth]
      .includes('role-and-position')){
      this.abortMaterialRequestOwner(requestOwner,'REQUEST_MATERIAL_ROLE_POSITION_UNSUPPORTED')
    }
    for(const insertion of [...plan.insertions,...(plan.anchoredInsertions??[])]){
      const support=insertion.requestedRole==='system'?capability?.systemAtDepth:capability?.[insertion.requestedRole]
      if(capability?.schemaVersion!==1||support!=='role-and-position'){
        this.abortMaterialRequestOwner(requestOwner,'REQUEST_MATERIAL_ROLE_POSITION_UNSUPPORTED')
      }
    }
    let assembly:PromptAssembly
    try {assembly=applyNativeOwnedSectionsV1(finalAssembly,plan,owner.sectionNames)}
    catch {this.abortMaterialRequestOwner(requestOwner,'REQUEST_MATERIAL_SECTION_SUPPRESSED_OR_CHANGED')}
    const systemCommits=this.systemPrompt.project(renderPrompt(assembly),{
      inHistory:preparedCall?.systemPromptUpdate==='in-history',startsSeries:true})
    // Material owns a new request series: normalize old effective system heads
    // so their prior resident contributions cannot survive behind the residual.
    const appends:SessionRequestAppendInput[]=systemCommits.map(({message,intent})=>({type:'system/message' as const,
      data:{turn,step,message},intent}))
    if(firstAttempt)for(const message of decision.messages){
      appends.push({type:'user/message',data:message,intent:{surfaceOp:'append'}})
    }
    const envelope=planNativeRequestEnvelope({config,...preparedCall?{preparedCall}:{},tools:assembly.tools,
      position:{turn,step},startsSeries:true,requestHeaderLogged:this.requestHeaderLogged,
      nextSeq:Number(this.session.seq)+appends.length,baseline:this.session.requestHeaderBoundary(),
      previousContext:this.session.requestContext()})
    appends.push(...envelope.appends)
    const preview=this.session.previewRequestAppends(appends)
    let protectedPrefixLength=0
    while(preview.messages[protectedPrefixLength]?.role==='system'
      ||preview.messages[protectedPrefixLength]?.role==='developer')protectedPrefixLength++
    let anchored:ReturnType<typeof resolveNativeOwnedMaterialAnchorsV1>
    try {anchored=resolveNativeOwnedMaterialAnchorsV1(plan,selected,preview,protectedPrefixLength)}
    catch(error) {
      const code=error instanceof Error&&/^REQUEST_MATERIAL_ANCHOR_[A-Z_]+$/.test(error.message)
        ?error.message:'REQUEST_MATERIAL_ANCHOR_RESOLUTION_FAILED'
      this.abortMaterialRequestOwner(requestOwner,code)
    }
    const result=planNativeRequestMaterialV1({turn,step,header:{seq:envelope.headerSeq,sha256:nativeInputSha256(envelope.header)},
      snapshot:plan.snapshot,plan:plan.plan,boundarySeq:Number(preview.boundarySeq),contentGeneration:preview.contentGeneration,
      surfaceNodes:preview.surfaceNodes,baseMessages:preview.messages,
      baseRefs:preview.messageNodes.map(({seq,message})=>({seq:Number(seq),id:String(message.id),role:message.role,
        messageSha256:nativeInputSha256(message)})),protectedPrefixLength,insertions:anchored.insertions})
    for(const expected of anchored.resolutions) {
      const actual=result.record.placements.find(row=>row.contributionRef===expected.contributionRef)
      if(!actual||actual.baseIndex!==expected.baseIndex) {
        this.abortMaterialRequestOwner(requestOwner,'REQUEST_MATERIAL_ANCHOR_PLACEMENT_CHANGED')
      }
    }
    this.checkMaterialOwner(requestOwner,decision.messages,plan,'planned-precommit')
    if(this.#materialSelected(decision.messages,firstAttempt).sha256!==selected.sha256){
      this.abortMaterialRequestOwner(requestOwner,'REQUEST_MATERIAL_SELECTED_BASE_CHANGED')
    }
    for(const planned of preview.events){
      this.checkMaterialOwner(requestOwner,decision.messages,plan,'planned-precommit')
      const event=this.#recordSelectionAppend(()=>{
        const committed=this.session.appendRequestPreviewEvent(preview)
        if(committed!==planned)throw Error('REQUEST_MATERIAL_COMMIT_CHANGED')
        return committed
      },planned.type==='user/message'?planned.data:undefined)
      if(event!==planned)throw Error('REQUEST_MATERIAL_COMMIT_CHANGED')
      if(event.type==='request/header')this.requestHeaderLogged=true
    }
    this.requestSurfaceGeneration=preview.contentGeneration
    const actual=this.session.currentRequestBoundary()
    if(actual.boundarySeq!==preview.boundarySeq||actual.contentGeneration!==preview.contentGeneration
      ||nativeInputSha256(actual.surfaceNodes)!==nativeInputSha256(preview.surfaceNodes)
      ||nativeInputSha256(actual.messages)!==nativeInputSha256(preview.messages)){
      this.abortMaterialRequestOwner(requestOwner,'REQUEST_MATERIAL_COMMITTED_BASE_CHANGED')
    }
    this.checkMaterialOwner(requestOwner,decision.messages,plan,'committed-predispatch')
    const material=this.#recordSelectionAppend(()=>this.session.append('request/material',result.record))
    const materialRef={seq:Number(material.seq),sha256:nativeInputSha256(material)}
    this.checkMaterialOwner(requestOwner,decision.messages,plan,'committed-predispatch',materialRef)
    signal.throwIfAborted()
    const boundaryMessages=[...result.messages]
    Object.freeze(boundaryMessages)
    deepFreeze(envelope.header)
    const request=markAgentLoopRequest(Object.freeze({...envelope.header.config,messages:boundaryMessages,
      toolHistory:this.session.toolHistory(),...envelope.header.tools?{tools:envelope.header.tools}:{},
      sessionId:this.session.id,signal}))
    bindNativeRequestMaterial(request,{session:this.session,event:material,assertOwnerCurrent:()=>{
      signal.throwIfAborted()
      this.checkMaterialOwner(requestOwner,decision.messages,plan,'committed-predispatch',materialRef)
    }})
    return request
  }

  /** Log the resolved envelope and derive a frozen request from the admitted surface. */
  private buildRequest(
    config: LlmCallConfig,
    preparedCall: PreparedLlmCall | undefined,
    tools: GenerateOptions['tools'] & object,
    position: { turn: number; step: number },
    startsRequestSeries: boolean,
    signal: AbortSignal,
  ): GenerateOptions {
    const { session } = this
    const surfaceGeneration = session.surface.contentGeneration
    const header = canonicalHeader({
      config,
      ...preparedCall === undefined ? {} : { adapterDefaults: preparedCall.adapterDefaults },
      ...tools.length > 0 ? { tools } : {},
    })
    const baseline = this.session.requestHeader()
    const startsSeries = startsRequestSeries
      || this.requestSurfaceGeneration !== surfaceGeneration
    let headerSeq: SessionSeq | undefined
    if (!this.requestHeaderLogged) {
      // Compaction during the first resumed pre-step must still mark a new series.
      headerSeq = this.#recordSelectionAppend(()=>this.session.append('request/header', {
        header,
        reason: baseline === undefined ? 'initial' : 'resume',
        ...startsSeries ? { startsSeries: true } : {},
      })).seq
      this.requestHeaderLogged = true
    } else if (baseline === undefined || !headerEquals(baseline, header)) {
      headerSeq = this.#recordSelectionAppend(()=>this.session.append('request/header', {
        header,
        reason: 'change',
        ...startsSeries ? { startsSeries: true } : {},
      })).seq
    } else if (startsSeries) {
      this.#recordSelectionAppend(()=>this.session.append('request/header', { header, reason: 'series' }))
    }
    if (baseline !== undefined && headerSeq !== undefined) {
      const previousNames = new Set(baseline.tools?.map(tool => tool.name))
      const currentNames = new Set(tools.map(tool => tool.name))
      const additions = tools.filter(tool => !previousNames.has(tool.name))
        .map(tool => ({ type: 'tool-addition' as const, toolName: tool.name }))
      const removals = (baseline.tools ?? []).filter(tool => !currentNames.has(tool.name))
        .map(tool => ({ type: 'tool-removal' as const, toolName: tool.name }))
      if (additions.length > 0 || removals.length > 0) {
        this.#recordSelectionAppend(()=>session.append('developer/message', {
          ...position,
          message: createDeveloperMessage({ source: { kind: 'tool-registry' }, content: [...additions, ...removals] }),
          ...additions.length > 0 ? { headerSeq } : {},
        }, { surfaceOp: 'append' }))
      }
    }
    this.requestSurfaceGeneration = surfaceGeneration

    const contextWindow = preparedCall?.context?.contextWindow
    const systemPromptUpdate = preparedCall?.systemPromptUpdate
    const requestContext: RequestContext = {
      provider: config.provider,
      model: config.model,
      ...contextWindow === undefined ? {} : { contextWindow },
      ...systemPromptUpdate === undefined ? {} : { systemPromptUpdate },
    }
    const previousContext = session.requestContext()
    if (previousContext?.provider !== requestContext.provider
      || previousContext.model !== requestContext.model
      || previousContext.contextWindow !== requestContext.contextWindow
      || previousContext.systemPromptUpdate !== requestContext.systemPromptUpdate) {
      this.#recordSelectionAppend(()=>session.append('request/context', requestContext))
    }
    signal.throwIfAborted()

    // canonicalHeader is shallow; append logs a detached snapshot, not these local values.
    deepFreeze(header)
    const boundaryMessages = session.deriveMessages()
    for (const message of boundaryMessages) {
      if (this.frozenMessages.has(message)) continue
      deepFreeze(message)
      this.frozenMessages.add(message)
    }
    Object.freeze(boundaryMessages)
    const request = markAgentLoopRequest(Object.freeze({
      ...header.config,
      messages: boundaryMessages,
      toolHistory: session.toolHistory(),
      ...header.tools !== undefined ? { tools: header.tools } : {},
      sessionId: this.session.id,
      signal,
    }))
    return request
  }
}
