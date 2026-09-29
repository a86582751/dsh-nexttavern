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
import type { AssistantMessage, GenerateOptions, LlmCallConfig, Message, PreparedLlmCall, ProgrammaticAssistantMessageSource } from '@deepseek-ai/dsh-llm'
import {
  LlmError,
  createAssistantMessage,
  createDeveloperMessage,
  errorChain,
  freezeMessage,
  markAgentLoopRequest,
} from '@deepseek-ai/dsh-llm'
import { assertNever, deepFreeze } from '@deepseek-ai/dsh-util-values'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { Scope } from '@deepseek-ai/dsh-scope'
import { createScope } from '@deepseek-ai/dsh-scope'
import type { EpochHeader, RequestContext, Session, SessionEvent, SessionId, SessionSeq, TurnEndReason, UserMessage } from '@deepseek-ai/dsh-session'
import { canonicalHeader, headerEquals } from '@deepseek-ai/dsh-session'
import { joinContextSections, renderContextSections, renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import type { PromptAssembly } from '@deepseek-ai/dsh-system-prompt'
import type {} from '@deepseek-ai/dsh-session-projection'
import type { Context } from '@deepseek-ai/cordis'
import { ReactLoopInbox } from './inbox.js'
import { RuntimeContextProjection } from './runtime-context.js'
import { AssistantStreamAttempt } from './assistant-stream.js'
import { SystemPromptProjection } from './runtime-context.js'
import { executeToolCalls } from './tool-calls.js'

type Phase =
  | { kind: 'idle'; lastTurn: number }
  | {
    kind: 'maintenance'
    abort: AbortController
    lastTurn: number
    wakeRequested: boolean
  }
  | { kind: 'running'; abort: AbortController; turn: number; step: number; wakeRequested: boolean;
    programmatic?: {operationId: string; messageId: string; instruction: string} }

type StepEndReason = Extract<TurnEndReason, { kind: 'completed' | 'max-tokens' }>

/** A caller-owned, stable identity for an assistant turn with no model request. */
export interface ProgrammaticAssistantCommit {
  operationId: string
  messageId: string
  text: string
  source: ProgrammaticAssistantMessageSource
}

/** Known admission refusals carry no new Session writes; durability failures have no code. */
export type ProgrammaticAssistantRejectionCode =
  | 'PROGRAMMATIC_IDENTITY_CONFLICT'
  | 'PROGRAMMATIC_OPEN_TURN'
  | 'PROGRAMMATIC_MISSING_SYSTEM_HEAD'

export type ProgrammaticAssistantCommitResult =
  | { kind: 'committed'; turn: number; messageId: string }
  | { kind: 'unknown'; reason: string; code?: ProgrammaticAssistantRejectionCode }
  | { kind: 'busy' }

export interface ProgrammaticAssistantGeneration {
  operationId: string
  messageId: string
  instruction: string
}

export type ProgrammaticAssistantGenerationResult = ProgrammaticAssistantCommitResult

type PreparedStep =
  | { kind: 'reject' }
  | {
    kind: 'enter'
    messages: UserMessage[]
    startsRequestSeries?: true
    assembly: PromptAssembly
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
    if (!options.keepInbox) {
      this.inbox.clear()
      if (this.phase.kind !== 'idle') this.phase.wakeRequested = false
    }
    if (this.phase.kind !== 'idle') this.phase.abort.abort(cause)
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
        this.setPhase({ kind: 'idle', lastTurn: maintenance.lastTurn })
        const cause = abortedCancelCause(maintenance.abort.signal)
        if (!this.programmaticTurnPoisoned && cause?.kind !== 'disposed'
          && maintenance.wakeRequested && this.inbox.hasPending) this.wakeDriver()
        done.resolve()
      }
    })()
  }

  /**
   * Append one complete assistant turn without entering the request pipeline.
   * The operation id lives in the message source so retries can inspect the
   * append-only log after a lost flush acknowledgement. A partial append is
   * never rolled back or continued by a second writer.
   */
  async commitProgrammaticAssistant(input: ProgrammaticAssistantCommit): Promise<ProgrammaticAssistantCommitResult> {
    if (this.phase.kind !== 'idle' || this.programmaticTurnPoisoned) return { kind: 'busy' }
    const validIdentity = (value: unknown): value is string => typeof value === 'string'
      && value.length > 0 && value.length <= 256 && value.trim() === value
      && !/[\u0000-\u001f\u007f]/u.test(value)
    if (!input || !validIdentity(input.operationId) || !validIdentity(input.messageId)
      || !input.source || input.source.kind !== 'programmatic' || input.source.schemaVersion !== 1
      || input.source.operationId !== input.operationId || !validIdentity(input.source.producer)
      || !validIdentity(input.source.origin) || typeof input.text !== 'string'
      || new TextEncoder().encode(input.text).length > 65_536) {
      throw new Error('invalid programmatic assistant commit identity, source, or text')
    }
    return this.runMaintenance<ProgrammaticAssistantCommitResult>(async () => {
      // Include inherited history: the operation may have committed before a
      // resume, or the flush acknowledgement may have been lost.
      const assistantEvents = this.session.snapshotEvents()
        .filter((event): event is SessionEvent<'assistant/message'> => event.type === 'assistant/message')
      const matching = assistantEvents.filter(event => event.data.message.source.kind === 'programmatic'
          && event.data.message.source.operationId === input.operationId)
      if (matching.length > 0) {
        if (matching.length !== 1) return { kind: 'unknown', reason: 'multiple messages have this operation id' }
        const event = matching[0]!
        const message = event.data.message
        if (message.source.kind !== 'programmatic') {
          return { kind: 'unknown', reason: 'operation source changed during retry inspection' }
        }
        if (message.id !== input.messageId || message.source.producer !== input.source.producer
          || message.source.origin !== input.source.origin || message.content.length !== 1
          || message.content[0]?.type !== 'text' || message.content[0].text !== input.text) {
          return { kind: 'unknown', reason: 'operation id belongs to a different message',
            code: 'PROGRAMMATIC_IDENTITY_CONFLICT' }
        }
        const closed = this.session.snapshotEvents().some(candidate => candidate.type === 'turn/end'
          && candidate.data.turn === event.data.turn && candidate.data.reason.kind === 'completed')
        if (!closed) return { kind: 'unknown', reason: 'assistant turn has no closing boundary' }
        try {
          if (!await this.ctx.sessions.flush(this.session)) {
            return { kind: 'unknown', reason: 'no durable session listener confirmed the flush' }
          }
          return { kind: 'committed', turn: event.data.turn, messageId: input.messageId }
        } catch {
          return { kind: 'unknown', reason: 'session flush did not confirm durability' }
        }
      }
      if (this.uncertainProgrammaticOperations.has(input.operationId)) {
        return { kind: 'unknown', reason: 'earlier append stopped before its message boundary' }
      }
      if (assistantEvents.some(event => event.data.message.id === input.messageId)) {
        return { kind: 'unknown', reason: 'message id already belongs to another operation',
          code: 'PROGRAMMATIC_IDENTITY_CONFLICT' }
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
        this.session.append('turn/start', { turn })
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
        this.uncertainProgrammaticOperations.add(input.operationId)
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

  /** Run one model turn from the assembled system prompt without creating a user message. */
  async generateProgrammaticAssistant(input: ProgrammaticAssistantGeneration): Promise<ProgrammaticAssistantGenerationResult> {
    const valid = (value: unknown): value is string => typeof value === 'string' && value.length > 0
      && value.length <= 256 && value.trim() === value && !/[\u0000-\u001f\u007f]/u.test(value)
    if (!input || !valid(input.operationId) || !valid(input.messageId)
      || typeof input.instruction !== 'string' || !input.instruction.trim()
      || new TextEncoder().encode(input.instruction).length > 65_536) {
      throw new Error('invalid programmatic generation identity or instruction')
    }
    if (this.phase.kind !== 'idle' || this.programmaticTurnPoisoned || this.inbox.hasPending) return {kind: 'busy'}
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
      step: 0, wakeRequested: false, programmatic: input})
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
    if (this.programmaticTurnPoisoned) return
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
      /* v8 ignore next -- kick owns a running phase until this driver boundary */
      if (this.phase.kind === 'running') {
        const { turn, wakeRequested } = this.phase
        this.setPhase({ kind: 'idle', lastTurn: turn })
        if (wakeRequested && this.inbox.hasPending) this.wakeDriver()
      }
    }
  }

  private async preStep(target: InboxTarget, position: { turn: number; step: number }): Promise<PreparedStep> {
    /* v8 ignore next -- private callers establish the running phase before proposing a step */
    if (this.phase.kind !== 'running') throw new Error(`agent "${this.id}": pre-step outside running phase`)
    const signal = this.phase.abort.signal
    const claimed = this.inbox.claim(target, position.turn)
    const assembled = await this.loopCtx.systemPrompt.assemble(assembleContextFor(this, signal))
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
    if (!generation) return {...decision, assembly}
    if (decision.messages.some(message => message.source.kind === 'user')) {
      throw new Error('programmatic generation cannot admit a player message')
    }
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

  /** Open one turn before claiming its first proposed step. */
  private async turn(): Promise<boolean> {
    if (this.phase.kind !== 'running') {
      this.throwError(new Error(`agent "${this.id}": turn without driver reservation`))
    }
    const phase = this.phase
    const { signal } = phase.abort
    signal.throwIfAborted()
    const turn = phase.turn + 1
    try {
      this.session.append('turn/start', { turn })
    } catch (error: unknown) {
      this.throwError(error)
    }
    phase.turn = turn
    let turnEnds: TurnEndReason | null = null
    let target: InboxTarget = 'next-turn'
    try {
      while (true) {
        signal.throwIfAborted()
        const step = phase.step + 1
        const decision = await this.preStep(target, { turn, step })
        if (decision.kind === 'reject') {
          turnEnds = { kind: 'blocked' }
          return false
        }
        if (turnEnds && decision.messages.length === 0) break
        // A removed waking message or an enter decision rewritten to empty
        // still owns the initial turn boundary, but it spends no model call.
        if (phase.step === 0 && decision.messages.length === 0 && !phase.programmatic) {
          turnEnds = { kind: 'completed' }
          return false
        }
        signal.throwIfAborted()
        this.session.append('step/start', { turn, step })
        phase.step = step
        try {
          // max-tokens is sticky: once any step hits the ceiling, later steps
          // that complete normally must not downgrade the turn outcome.
          const stepEnd = await this.step(decision)
          // max-tokens stays sticky: a later completed step must not
          // downgrade the turn outcome.
          if (turnEnds === null || turnEnds.kind !== 'max-tokens') turnEnds = stepEnd
        } finally {
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
      try {
        // oxlint-disable-next-line typescript/no-non-null-assertion -- every exit assigns a turn ending
        this.session.append('turn/end', { turn, reason: turnEnds! })
      } catch (error: unknown) {
        this.throwError(error)
      }
    }
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
      const { config, preparedCall } = await this.prepareRequest(turn, step, signal)
      const startsRequestSeries = firstAttempt && decision.startsRequestSeries === true
      const commits = this.systemPrompt.project(renderedPrompt, {
        inHistory: preparedCall?.systemPromptUpdate === 'in-history',
        startsSeries: startsRequestSeries
          || this.requestSurfaceGeneration !== this.session.surface.contentGeneration
          || (preparedCall?.toolUpdate === undefined && this.toolsChanged(assembly.tools)),
      })
      for (const { message, intent } of commits) {
        this.session.append('system/message', { turn, step, message }, intent)
      }
      if (firstAttempt) {
        for (const message of decision.messages) {
          this.session.append('user/message', message, { surfaceOp: 'append' })
        }
      }
      firstAttempt = false
      const request = this.buildRequest(config, preparedCall, assembly.tools, { turn, step }, startsRequestSeries, signal)
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
            () => this.session.append('assistant/attempt', { turn, step, stream: live.stream }).seq,
          )
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
          continue
        }

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
      headerSeq = this.session.append('request/header', {
        header,
        reason: baseline === undefined ? 'initial' : 'resume',
        ...startsSeries ? { startsSeries: true } : {},
      }).seq
      this.requestHeaderLogged = true
    } else if (baseline === undefined || !headerEquals(baseline, header)) {
      headerSeq = this.session.append('request/header', {
        header,
        reason: 'change',
        ...startsSeries ? { startsSeries: true } : {},
      }).seq
    } else if (startsSeries) {
      this.session.append('request/header', { header, reason: 'series' })
    }
    if (baseline !== undefined && headerSeq !== undefined) {
      const previousNames = new Set(baseline.tools?.map(tool => tool.name))
      const currentNames = new Set(tools.map(tool => tool.name))
      const additions = tools.filter(tool => !previousNames.has(tool.name))
        .map(tool => ({ type: 'tool-addition' as const, toolName: tool.name }))
      const removals = (baseline.tools ?? []).filter(tool => !currentNames.has(tool.name))
        .map(tool => ({ type: 'tool-removal' as const, toolName: tool.name }))
      if (additions.length > 0 || removals.length > 0) {
        session.append('developer/message', {
          ...position,
          message: createDeveloperMessage({ source: { kind: 'tool-registry' }, content: [...additions, ...removals] }),
          ...additions.length > 0 ? { headerSeq } : {},
        }, { surfaceOp: 'append' })
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
      session.append('request/context', requestContext)
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
