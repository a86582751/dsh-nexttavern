/** Reference-only owner of Core permissions over actual Native input work.
 * No input body, queue, model classification or Source lock belongs here. */
import {createHash, randomUUID} from 'node:crypto'
import {createRoleplayInputContinuation} from './roleplay-input-continuation.js'
import {createRoleplayInputCompletion,readInputCompletion} from './roleplay-input-completion.js'
import type {InputCompletionProcessor,InputCompletionScope} from './roleplay-input-completion.js'
import type {MvuStateTerminalIntent} from './roleplay-mvu-state.js'
import type {OwnedContinuationResult} from './roleplay-input-continuation.js'
import type {taskPhaseMessage} from './tavern-task-context.js'
import type {NativeInputAdmissionAgentV2, NativeInputAdmissionHookV2, NativeInputAdmissionCheckV2,
  NativeDurableInputWorkReceiptV1, NativeInputRef, NativePreparationReceiptV1,
  NativeInputStopNoticeV1, NativeInputBlocked, NativeInputLinkV1} from '@deepseek-ai/dsh-agent-loop'

export const ROLEPLAY_INPUT_NAMESPACE = 'nexttavern.roleplay.input.v2'
export interface InputPreparationTable {
  get(key: string): unknown
  put(key: string, value: Record<string, unknown>): Promise<unknown>
  entries(): Iterable<[string, unknown]>
}
export type InputHeadRef = {kind: 'numerical-head' | 'plain-absence'; sha256: string}
export type InputObservation =
  | {kind: 'legacy'; sourceSha256: string; reason: string}
  | {kind: 'management'; sourceSha256: string; reason: string}
  | {kind: 'story'; sourceSha256: string; headRef?: InputHeadRef; absenceScopeRef?: InputHeadRef}
export type InputSourceObservation = InputObservation
export interface InputPreparationSnapshotRef {
  key: string
  sha256: string
}
export interface InputTransitionProof {
  callId: string
  playerRef: NativeInputRef
  sourceProofSha256: string
  channel: 'chat-attachment' | 'workspace'
  requestId: string
  sourceSha256: string
  rawSourceSha256: string
}
export interface InputTransitionJob {
  jobId: string
  jobGeneration: string
  requestId: string
  rawSourceSha256: string
}
export interface InputLegacyMergeReference {
  schemaVersion:1
  kind:'semantic-merge-source'
  importId:string
  normalizedSha256:string
}
export interface InputTransitionActivationProof {
  importId: string
  transactionId: string
  oldPointerSha256: string
  writeDigests: Readonly<Record<string, string>>
}
export interface InputTransitionActivation extends InputTransitionActivationProof {
  sourceSha256: string
}
export interface InputPreparationCurrency {
  schemaVersion: 2
  preparationId: string
  credentialSha256: string
  receiptGeneration: number
  attemptGeneration: number
  source: InputSourceObservation
  snapshot?: InputPreparationSnapshotRef
}
export interface RoleplayInputStep {
  /** Opaque hot authority; reconstructed JSON is never an accepted step. */
  readonly currency: InputPreparationCurrency
  readonly kind: InputSourceObservation['kind'] | 'maintenance'
}
export interface RoleplayInputTransitionReservation {
  readonly reservationId: string
  readonly preparationId: string
  readonly proof: InputTransitionProof
}
export type InputSnapshotBinding = InputPreparationCurrency
export type InputStep = RoleplayInputStep
export interface InputView {
  preparationId: string
  receiptGeneration: number
  kind: InputObservation['kind'] | 'maintenance'
  status: Work['status']
  checkpoint?: NativeDurableInputWorkReceiptV1
  attemptGeneration: number
  currency?: InputPreparationCurrency
  prepared: boolean
  refs: readonly NativeInputRef[]
}
export type InputTransitionResult = {kind: 'acknowledged'} | {kind: 'unknown'; code: string}
export interface RoleplayInputTransitionLease {
  readonly reservationId: string
  reserve(proof: InputTransitionProof): Promise<void>
  bindJob(job: InputTransitionJob): Promise<void>
  prepareActivation(proof: InputTransitionActivationProof): Promise<void>
  delegateLegacy(proof: InputTransitionProof,merge?:InputLegacyMergeReference): Promise<void>
  commit(activation: InputTransitionActivation): Promise<InputTransitionResult>
  checkActivation(): void
  getActivationProof(): InputTransitionActivationProof | undefined
  isLegacy(): boolean
  rejectSource(code?: string): Promise<void>
  fail(code: string): Promise<unknown>
}
export interface RoleplayInputBinding {
  beginStep(input: {turn: number; step: number; signal: AbortSignal; legacyPreparationId?: string}): Promise<RoleplayInputStep>
  checkCurrency(step: RoleplayInputStep): {kind: 'allow'} | {kind: 'blocked'; code: string}
  prepare(step: RoleplayInputStep, snapshot?: InputPreparationSnapshotRef): Promise<InputPreparationCurrency>
  checkSnapshot(currency: InputPreparationCurrency): {kind: 'allow'} | {kind: 'blocked'; code: string}
  checkAttempt(currency: InputPreparationCurrency): {kind: 'allow'} | {kind: 'blocked'; code: string}
  persistedCurrency(): InputPreparationCurrency | undefined
  currentStep(): RoleplayInputStep | undefined
  existingTransition(): {lease: RoleplayInputTransitionLease; proof: InputTransitionProof} | undefined
  originalMessages(step: RoleplayInputStep): NativeInputAdmissionCheckV2['claim']['messages']
  steerOwnedContinuation(message:ReturnType<typeof taskPhaseMessage>,turn:number):OwnedContinuationResult
  checkHistoricalTaskCurrency(currency: InputPreparationCurrency): {kind: 'allow'} | {kind: 'blocked'; code: string}
  checkHistoricalSnapshot(currency: InputPreparationCurrency): {kind: 'allow'} | {kind: 'blocked'; code: string}
  historicalCurrency(currency: InputPreparationCurrency): InputPreparationCurrency | undefined
  beginTransition(step: RoleplayInputStep, actualCall: {callId: string; playerRef: NativeInputRef}): RoleplayInputTransitionLease
  commitTransition(reservation: RoleplayInputTransitionReservation, activation: InputTransitionActivation): Promise<InputTransitionResult>
  current(): InputView | undefined
  dispose(): void
}
export interface InputTransitionState {
  reservation: RoleplayInputTransitionReservation
  from: InputSourceObservation
  status: 'revoked' | 'reserved' | 'job-bound' | 'activation-prepared' | 'committed' | 'legacy-delegated' | 'source-rejected' | 'unknown'
  job?: InputTransitionJob
  legacyRecord?:InputLegacyMergeReference
  activationProof?: InputTransitionActivationProof
  activation?: InputTransitionActivation
  to?: InputSourceObservation
}
type Transition=InputTransitionState
interface UnclaimedInputRefusal {
  schemaVersion:1
  kind:'unclaimed-native-refusal'
  code:string
  refsSha256:string
  throughSeq:number
  historyPrefixSha256:string
  proofSha256:string
}
interface Work extends Record<string, unknown> {
  schemaVersion: 2
  namespace: typeof ROLEPLAY_INPUT_NAMESPACE
  sessionId: string
  branchId: string
  preparationId: string
  receiptGeneration: number
  refs: readonly NativeInputRef[]
  credentialSha256: string
  preparation: NativePreparationReceiptV1
  status: 'created' | 'active' | 'stopped' | 'unknown'
  source: InputSourceObservation
  attemptGeneration: number
  attempt?: {turn: number; step: number; prepared: boolean; legacyPreparationId?: string;
    snapshot?: InputPreparationSnapshotRef}
  checkpoint?: NativeDurableInputWorkReceiptV1
  /** Frozen at creation, before Native claim/checkpoint. Cold admission must
   * not reinterpret an unfinished numerical work as an ordinary input. */
  terminalRequired?:true
  /** A live admission refused before any Native claim. Missing checkpoint
   * alone is never evidence of this disposition. */
  unclaimedRefusal?:UnclaimedInputRefusal
  transition?: Transition
  stop?: {status: 'terminal' | 'unknown'; notice?: NativeInputStopNoticeV1; code?: string}
}
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort()
    .filter(key => (value as Record<string, unknown>)[key] !== undefined)
    .map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}
const digest = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex')
const equal = (a: unknown, b: unknown) => canonical(a) === canonical(b)
const clone = <T>(value: T): T => structuredClone(value)
const prefix = (sessionId: string) => `${sessionId}__native-input-v2-`
const workKey = (sessionId: string, refs: readonly NativeInputRef[]) => `${prefix(sessionId)}work-${digest(refs)}`
const currentKey = (sessionId: string) => `${prefix(sessionId)}current`
const blocked = (code: string) => ({kind: 'blocked' as const, code})
const allowed = {kind: 'allow' as const}
function fail(code: string): never {throw new Error(code)}
const sha = (value: string) => /^[a-f0-9]{64}$/.test(value)
const boundedId = (value: string) => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
// Match the import transaction's existing CAS encoding for an absent record.
const recordDigest = (value: string) => value === 'missing' || sha(value)
const identityOf = (work: Work) => ({schemaVersion: 2, namespace: work.namespace, sessionId: work.sessionId,
  branchId: work.branchId, preparationId: work.preparationId, receiptGeneration: work.receiptGeneration, refs: work.refs,
  ...(work.terminalRequired?{terminalRequired:true}:{})})
const currencyOfStored=(work:Work):InputPreparationCurrency=>({schemaVersion:2,
  preparationId:work.preparationId,credentialSha256:work.credentialSha256,receiptGeneration:work.receiptGeneration,
  attemptGeneration:work.attemptGeneration,source:clone(work.source),
  ...(work.attempt?.snapshot?{snapshot:clone(work.attempt.snapshot)}:{})})
const refusalSeal=(work:Work,proof:Omit<UnclaimedInputRefusal,'proofSha256'>)=>digest({
  preparationId:work.preparationId,credentialSha256:work.credentialSha256,...proof})
const validRefusal=(work:Work):boolean=>{
  const proof=work.unclaimedRefusal
  if(!proof)return false
  const {proofSha256,...payload}=proof
  return proof.schemaVersion===1&&proof.kind==='unclaimed-native-refusal'
    &&typeof proof.code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/.test(proof.code)
    &&proof.refsSha256===digest(work.refs)&&Number.isSafeInteger(proof.throughSeq)&&proof.throughSeq>=0
    &&sha(proof.historyPrefixSha256)&&proofSha256===refusalSeal(work,payload)
}
const isWork = (value: unknown, sessionId: string): value is Work => {
  const row = value as Work | undefined
  return !!row && row.schemaVersion === 2 && row.namespace === ROLEPLAY_INPUT_NAMESPACE
    && row.sessionId === sessionId && row.branchId === sessionId && typeof row.preparationId === 'string'
    && Number.isSafeInteger(row.receiptGeneration) && row.receiptGeneration > 0 && Array.isArray(row.refs)
    && row.refs.length > 0 && row.refs.every(ref => ref.sessionId === sessionId && sha(ref.messageSha256))
    && (row.terminalRequired===undefined||row.terminalRequired===true)
    && (row.unclaimedRefusal===undefined||validRefusal(row))
    && row.credentialSha256 === digest(identityOf(row))
    && equal(row.preparation, {schemaVersion: 1, namespace: ROLEPLAY_INPUT_NAMESPACE,
      preparationKeySha256: digest({sessionId, preparationId: row.preparationId}), credentialSha256: row.credentialSha256})
}

export function createRoleplayInputPreparation<Session extends {id: string}>({table, observe, onError,completion}: {
  table: InputPreparationTable
  /** Trusted synchronous actual Source/head observation; never model intent. */
  observe(session: Session): InputSourceObservation
  onError?(error: unknown): void
  completion?:InputCompletionProcessor
}) {
  const owners = new WeakMap<object, RoleplayInputBinding>()
  const leases = new Map<string, RoleplayInputTransitionLease>()
  const reservationLeases = new Map<string, RoleplayInputTransitionLease>()
  const sessionOwners = new Map<string, object>()
  const terminalOwners=new Map<string,ReturnType<typeof createRoleplayInputCompletion>>()
  // A single writer orders this owner's records. It never invokes Source work
  // or waits Agent idle while holding this chain.
  let writes: Promise<unknown> = Promise.resolve()
  const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
    const next = writes.then(operation)
    writes = next.catch(() => {})
    return next
  }
  const report = (error: unknown) => {try {onError?.(error)} catch { /* Reporting cannot restore authority. */ }}
  const records = (sid: string): Work[] => [...table.entries()]
    .filter(([key, value]) => key.startsWith(`${prefix(sid)}work-`) && isWork(value, sid))
    .map(([, value]) => clone(value as Work))
  const observeExact = (session: Session) => {
    const result = clone(observe(session))
    if (!sha(result.sourceSha256) || !['legacy', 'management', 'story'].includes(result.kind)
      || result.kind === 'story' && (!result.headRef && !result.absenceScopeRef
        || !!result.headRef && !!result.absenceScopeRef
        || !sha((result.headRef ?? result.absenceScopeRef)!.sha256))
      || result.kind !== 'story' && !result.reason) fail('INPUT_SOURCE_OBSERVATION_INVALID')
    return result
  }
  /** Check actual Native facts, including canceled refs that might otherwise
   * hide a prior claim. A crash between work creation and this proof stays
   * unresolved; cold recovery cannot infer permission from missing rows. */
  const unclaimedFacts=(agent:NativeInputAdmissionAgentV2 & {session:Session},work:Work)=>{
    if(work.checkpoint||work.attempt||work.transition||work.attemptGeneration!==0)return undefined
    const events=agent.session.snapshotEvents()
    let previous=-1
    for(const event of events) {
      const seq=Number(event.seq)
      if(!Number.isSafeInteger(seq)||seq<=previous)return undefined
      previous=seq
      if(event.type==='turn/start'&&event.data.nativeInputLink) {
        const link=event.data.nativeInputLink as NativeInputLinkV1
        if(!Array.isArray(link.refs)||!link.preparation)return undefined
        if(equal(link.preparation,work.preparation)
          ||link.refs.some(ref=>work.refs.some(owned=>equal(ref,owned))))return undefined
      }
    }
    if(previous<Math.max(...work.refs.map(ref=>ref.insertSeq)))return undefined
    for(const ref of work.refs) {
      const ownership=agent.lookupInputOwnership(ref)
      if(ownership.status==='cancelled') {
        // Native also reports a claimed, aborted old turn as canceled. Only an
        // actual inbox deletion with no closed claim reason proves no claim.
        const canceled=events.find(event=>Number(event.seq)===ownership.cancelSeq)
        if(ownership.closedReason||canceled?.type!=='agent/inbox/spliced'
          ||canceled.data.outcome!=='canceled')return undefined
      } else if(ownership.status!=='pending')return undefined
    }
    return {events,throughSeq:previous}
  }
  const verifyUnclaimedRefusal=(sid:string,work:Work)=>{
    if(!validRefusal(work))return false
    const agent=sessionOwners.get(sid) as NativeInputAdmissionAgentV2 & {session:Session}|undefined
    if(!agent)return false
    const facts=unclaimedFacts(agent,work),proof=work.unclaimedRefusal!
    if(!facts||proof.throughSeq>facts.throughSeq)return false
    const history=facts.events.filter(event=>Number(event.seq)<=proof.throughSeq)
    return Number(history.at(-1)?.seq)===proof.throughSeq&&digest(history)===proof.historyPrefixSha256
  }
  /** Separate from physical numerical/Source observation. In particular our
   * own pending terminal must not make an in-flight snapshot self-stale. This
   * read-only gate is also available to deterministic management diagnostics. */
  const readTerminalAdmissionGate=(sid:string,known?:Work[])=>{
    if(!completion)return allowed
    try {
      if([...table.entries()].some(([recordKey,value])=>recordKey.startsWith(`${prefix(sid)}work-`)&&!isWork(value,sid))) {
        return blocked('INPUT_STORED_WORK_UNKNOWN')
      }
      for(const work of known??records(sid))if(work.terminalRequired) {
        if(verifyUnclaimedRefusal(sid,work))continue
        const closed=readInputCompletion(table,sid,work.preparationId)
        if(!closed||closed.status!=='settled'||work.stop||work.status!=='active'
          ||!equal(closed.scope.currency,currencyOfStored(work))||!equal(closed.scope.receipt.checkpoint,work.checkpoint)
          ||!equal(closed.scope.transition,work.transition)
          // Consumed facts verify their actual closed prefix themselves. A
          // later editorial revision must not recreate old publisher rights.
          ||!completion.verifyConsumed(closed.scope,closed.plan,closed.settlement))return blocked('INPUT_PREVIOUS_TERMINAL_UNRESOLVED')
      }
      return allowed
    } catch {return blocked('INPUT_PREVIOUS_TERMINAL_UNKNOWN')}
  }

  /** Caller must obtain this exact Agent from its owning Native factory. No
   * duck-typed service wrapper or brand lookup after disposal is accepted. */
  function bind(agent: NativeInputAdmissionAgentV2 & {session: Session}): RoleplayInputBinding {
    const cached = owners.get(agent)
    if (cached) return cached
    const sid = agent.session.id
    if (sessionOwners.has(sid)) fail('INPUT_SESSION_ALREADY_BOUND')
    sessionOwners.set(sid, agent)
    // A remounted owner cannot know whether old pending refs lost a stop ACK.
    // Only a future actual Native insertion can obtain a fresh credential.
    let boundSeq = -1
    for (const event of agent.session.snapshotEvents()) boundSeq = Math.max(boundSeq, Number(event.seq))
    let live = true, hot: Work | undefined, claim: NativeInputAdmissionCheckV2['claim'] | undefined
    let revoked = false
    let currentStep: RoleplayInputStep | undefined
    let currentLease: RoleplayInputTransitionLease | undefined
    const steps = new WeakMap<RoleplayInputStep, {work: Work; generation: number; signal: AbortSignal}>()
    const reservations = new WeakMap<RoleplayInputTransitionReservation, {work: Work; step: RoleplayInputStep}>()
    const lifecycle = new Map<string, {identity: unknown; receipt: NativeDurableInputWorkReceiptV1}>()
    const pendingRevocations = new Set<string>()
    const key = (work: Work) => workKey(sid, work.refs)
    const durable = (work: Work) => table.get(key(work))
    const sameDurable = (work: Work) => equal(durable(work), work)
    const checkpointAssociation = (receipt: NativeDurableInputWorkReceiptV1): boolean => {
      const events = agent.session.snapshotEvents()
      const start = events.find(event => Number(event.seq) === receipt.startSeq)
      const firstStep = events.find(event => Number(event.seq) === receipt.firstStepStartSeq)
      const marker = (start?.type === 'turn/start' ? start.data.nativeInputLink : undefined) as NativeInputLinkV1 | undefined
      return receipt.schemaVersion === 1 && receipt.sessionId === sid && !!marker && marker.mode === 'claim'
        && receipt.workSha256 === digest({schemaVersion: 1, encoding: 'native-input-work-v1', sessionId: sid,
          preparation: receipt.preparation, refs: receipt.refs})
        && start?.type === 'turn/start' && start.data.turn === receipt.actualTurn
        && marker.workSha256 === receipt.workSha256 && equal(marker.preparation, receipt.preparation)
        && equal(marker.refs, receipt.refs) && receipt.startSeq < receipt.firstStepStartSeq
        && firstStep?.type === 'step/start' && firstStep.data.turn === receipt.actualTurn && firstStep.data.step === 1
        && events.filter(event => Number(event.seq) > receipt.startSeq && Number(event.seq) < receipt.firstStepStartSeq)
          .every(event => event.type !== 'step/start' && event.type !== 'turn/end')
    }
    const save = async (work: Work) => {await table.put(key(work), clone(work)); if (!sameDurable(work)) fail('INPUT_WRITE_UNCONFIRMED')}
    const refuseUnclaimed=async(work:Work,code:string)=>{
      // This runs inside the live admit operation, before it can return allow.
      // Read back the owned write first; failed/ambiguous storage stays closed.
      try {
        const stored=durable(work)
        // stop revokes the hot object synchronously while its durable save is
        // queued after this admission. Permit exactly that known delta, not an
        // arbitrary replacement of the owned record or an absent first write.
        const knownStopDelta=isWork(stored,sid)&&stored.status==='created'&&!stored.stop
          &&!!work.stop&&pendingRevocations.has(work.preparationId)
          &&['stopped','unknown'].includes(work.status)
          &&equal({...stored,status:undefined,stop:undefined},{...work,status:undefined,stop:undefined})
        if(work.terminalRequired&&(sameDurable(work)||knownStopDelta)) {
          const facts=unclaimedFacts(agent,work)
          if(facts) {
            const proof:Omit<UnclaimedInputRefusal,'proofSha256'>={schemaVersion:1,
              kind:'unclaimed-native-refusal',code,refsSha256:digest(work.refs),throughSeq:facts.throughSeq,
              historyPrefixSha256:digest(facts.events)}
            work.unclaimedRefusal={...proof,proofSha256:refusalSeal(work,proof)}
            await save(work)
          }
        }
      } catch(error) {report(error)}
      return blocked(code)
    }
    const currencyOf = (work: Work): InputPreparationCurrency => ({schemaVersion: 2,
      preparationId: work.preparationId, credentialSha256: work.credentialSha256, receiptGeneration: work.receiptGeneration,
      attemptGeneration: work.attemptGeneration, source: clone(work.source),
      ...(work.attempt?.snapshot ? {snapshot: clone(work.attempt.snapshot)} : {})})
    const historical = (currency: InputPreparationCurrency): {work?: Work; code?: string} => {
      const proof = lifecycle.get(currency.preparationId)
      if (!live || !proof || pendingRevocations.has(currency.preparationId)) return {code: 'HISTORICAL_STOP_STATE_UNKNOWN'}
      const matches = records(sid).filter(work => work.preparationId === currency.preparationId)
      if (matches.length !== 1) return {code: 'HISTORICAL_WORK_UNKNOWN'}
      const work = matches[0]!
      const base = currencyOf(work), {snapshot: ignored, ...suppliedBase} = currency
      const {snapshot: storedSnapshot, ...storedBase} = base
      void ignored; void storedSnapshot
      if (!equal(identityOf(work), proof.identity) || !equal(suppliedBase, storedBase)
        || !equal(work.checkpoint, proof.receipt) || work.status !== 'active' || !work.attempt?.prepared
        || work.source.kind !== 'story' || work.transition || work.stop || !equal(observeExact(agent.session), work.source)) {
        return {code: 'HISTORICAL_CURRENCY_CHANGED'}
      }
      if ([...table.entries()].some(([recordKey, value]) => {
        if (!recordKey.startsWith(`${prefix(sid)}stop-`)) return false
        const row = value as {refs?: NativeInputRef[]; notice?: NativeInputStopNoticeV1}
        return !Array.isArray(row.refs) || row.notice?.refsCode && !row.refs.length
          || row.refs.some(ref => work.refs.some(owned => equal(ref, owned)))
      })) return {code: 'HISTORICAL_STOP_STATE_UNKNOWN'}
      const receipt = proof.receipt, events = agent.session.snapshotEvents(), inherited = agent.session.inheritedEventCount
      const startIndex = events.findIndex(event => Number(event.seq) === receipt.startSeq)
      const ends = events.filter(event => event.type === 'turn/end' && event.data.turn === receipt.actualTurn)
      if (!Number.isSafeInteger(inherited) || inherited < 0 || startIndex < inherited || !checkpointAssociation(receipt)
        || ends.length !== 1 || ends[0]?.type !== 'turn/end' || ends[0].data.reason.kind !== 'completed'
        || Number(ends[0].seq) <= receipt.firstStepStartSeq) return {code: 'HISTORICAL_NATIVE_ASSOCIATION_UNKNOWN'}
      let removed = 0, previous = receipt.startSeq
      for (const seq of receipt.claimSpliceSeqs) {
        const event = events.find(row => Number(row.seq) === seq)
        if (seq <= previous || seq >= receipt.firstStepStartSeq || event?.type !== 'agent/inbox/spliced'
          || event.data.outcome === 'canceled' || event.data.inserted.length || event.data.start !== 0
          || !event.data.removedCount) return {code: 'HISTORICAL_CLAIM_UNKNOWN'}
        removed += event.data.removedCount; previous = seq
      }
      if (removed !== work.refs.length) return {code: 'HISTORICAL_CLAIM_UNKNOWN'}
      for (const ref of work.refs) {
        const input = agent.lookupInputOwnership(ref)
        const insertIndex = events.findIndex(event => Number(event.seq) === ref.insertSeq)
        if (insertIndex < inherited || input.status !== 'admitted' || input.turn !== receipt.actualTurn
          || input.userSeq <= receipt.firstStepStartSeq || input.userSeq >= Number(ends[0].seq)) {
          return {code: 'HISTORICAL_INPUT_ADMISSION_UNKNOWN'}
        }
      }
      return {work}
    }
    const baseCurrency = (work: Work): string | undefined => {
      if (!live || revoked || hot !== work || work.stop || ['stopped', 'unknown'].includes(work.status)) return 'INPUT_PERMISSION_REVOKED'
      if (!sameDurable(work)) return 'INPUT_WORK_CHANGED'
      const pointer = table.get(currentKey(sid)) as {preparationId?: string; credentialSha256?: string} | undefined
      if (pointer?.preparationId !== work.preparationId || pointer.credentialSha256 !== work.credentialSha256) return 'INPUT_CURRENT_CHANGED'
      const actualSource = observeExact(agent.session)
      const legacyCompatibility = work.source.kind === 'legacy' && actualSource.kind === 'legacy'
      const boundedManagement = (work.source.kind === 'management' || work.transition?.status === 'committed')
        && actualSource.sourceSha256 === work.source.sourceSha256
      if (!legacyCompatibility && !boundedManagement && !equal(actualSource, work.source)) {
        return 'INPUT_SOURCE_CHANGED'
      }
      return undefined
    }
    const stepCurrency = (step: RoleplayInputStep): string | undefined => {
      const entry = steps.get(step)
      if (!entry || currentStep !== step || entry.work !== hot || entry.generation !== hot?.attemptGeneration
        || entry.signal.aborted) return 'INPUT_ATTEMPT_CHANGED'
      return baseCurrency(entry.work)
    }
    const terminalStored=(scope:InputCompletionScope):string|undefined=>{
      const work=hot,pointer=table.get(currentKey(sid)) as {preparationId?:string;credentialSha256?:string}|undefined
      if(!live||revoked||!work||work.status!=='active'||work.stop||pendingRevocations.has(work.preparationId)
        ||!work.terminalRequired||!sameDurable(work)||!equal(currencyOf(work),scope.currency)
        ||!equal(work.checkpoint,scope.receipt.checkpoint)||!checkpointAssociation(scope.receipt.checkpoint)
        ||pointer?.preparationId!==work.preparationId||pointer.credentialSha256!==work.credentialSha256) {
        return 'INPUT_TERMINAL_STORED_WORK_CHANGED'
      }
      return undefined
    }
    const terminal=completion?createRoleplayInputCompletion({sessionId:sid,table,enqueue,
      processor:completion,
      current:()=>hot?.checkpoint&&hot.terminalRequired&&hot.attempt?.prepared&&!hot.stop&&!revoked&&live
        ? {currency:currencyOf(hot),checkpoint:hot.checkpoint,
          ...(hot.transition?{transition:clone(hot.transition) as unknown as Record<string,unknown>}:{})}:undefined,
      checkOriginal:()=>!hot?'INPUT_NO_CURRENT_CLAIM':baseCurrency(hot),checkStored:terminalStored,
      nativeCurrent:receipt=>{
        const found=agent.lookupInputCompletion()
        return found.status==='pending'&&equal(found.receipt,receipt)&&equal(found.checkpoint,receipt.checkpoint)
      },
    }):undefined
    if(terminal)terminalOwners.set(sid,terminal)
    const continuation = createRoleplayInputContinuation({
      current:()=>hot?.checkpoint&&hot.attempt?.prepared&&hot.attempt.snapshot&&!hot.transition
        ? {currency:currencyOf(hot),checkpoint:hot.checkpoint}:undefined,
      checkCurrent:()=>!hot||!currentStep||stepCurrency(currentStep)||hot.source.kind!=='story'
        ||!hot.checkpoint||!hot.attempt?.prepared||!hot.attempt.snapshot||hot.transition
        ? 'INPUT_CONTINUATION_SCOPE_INVALID':undefined,
    })
    const stop = (notice: NativeInputStopNoticeV1) => {
      if (notice.refsCode) for (const preparationId of lifecycle.keys()) pendingRevocations.add(preparationId)
      for (const [preparationId, proof] of lifecycle) {
        if (notice.preparation && equal(proof.receipt.preparation, notice.preparation)
          || notice.refs.some(ref => proof.receipt.refs.some(owned => equal(ref, owned)))) pendingRevocations.add(preparationId)
      }
      // An unrelated idle stop has no historical selector. Do not mutate old
      // completed input based solely on the stale current pointer.
      const matchesHot = !!hot && (notice.refsCode || continuation.ownsRefs(notice.refs)
        || notice.preparation && equal(hot.preparation, notice.preparation)
        || notice.refs.some(ref => hot!.refs.some(owned => equal(ref, owned))))
      if (hot && matchesHot) {
        terminal?.revoke()
        continuation.close()
        revoked = true
        hot.stop = {status: notice.refsCode ? 'unknown' : 'terminal', notice: clone(notice), ...(notice.refsCode ? {code: notice.refsCode} : {})}
        hot.status = notice.refsCode ? 'unknown' : 'stopped'
      }
      let readFailed = false, readError: unknown, targets: Work[] = []
      try {targets = records(sid).filter(work => notice.preparation ? equal(work.preparation, notice.preparation)
        : notice.refs.some(ref => work.refs.some(owned => equal(ref, owned))))}
      catch (error) {readFailed = true; readError = error}
      if (hot && matchesHot && !targets.some(work => work.preparationId === hot!.preparationId)) targets.push(hot)
      if (notice.refsCode || readFailed) for (const preparationId of lifecycle.keys()) pendingRevocations.add(preparationId)
      for (const target of targets) pendingRevocations.add(target.preparationId)
      if (readFailed) report(readError)
      const effectiveRefs = clone(notice.refs.length ? notice.refs : matchesHot ? hot!.refs : [])
      const unknownCode = notice.refsCode ?? (readFailed ? 'INPUT_STOP_READ_UNKNOWN' : undefined)
      return enqueue(async () => {
        try {
          if (notice.refs.length || notice.refsCode) {
            const tombstoneKey = `${prefix(sid)}stop-${digest({stopNonce: notice.stopNonce, stopSequence: notice.stopSequence})}`
            const tombstone = {schemaVersion: 2, namespace: ROLEPLAY_INPUT_NAMESPACE, sessionId: sid,
              refs: effectiveRefs, notice: clone(notice), status: unknownCode ? 'unknown' : 'terminal'}
            await table.put(tombstoneKey, tombstone)
            if (!equal(table.get(tombstoneKey), tombstone)) fail('INPUT_STOP_WRITE_UNKNOWN')
          }
          for (const target of targets) {
            const saved = table.get(key(target))
            const work = hot?.preparationId === target.preparationId ? hot : isWork(saved, sid) ? clone(saved) : target
            work.stop = {status: unknownCode ? 'unknown' : 'terminal', notice: clone(notice), ...(unknownCode ? {code: unknownCode} : {})}
            work.status = unknownCode ? 'unknown' : 'stopped'
            await save(work)
          }
          return {schemaVersion: 1 as const, stopSequence: notice.stopSequence, stopNonce: notice.stopNonce,
            ...(unknownCode ? {kind: 'unknown' as const, code: unknownCode} : {kind: 'acknowledged' as const})}
        } catch (error) {
          revoked = targets.length > 0 || revoked
          report(error)
          return {schemaVersion: 1 as const, stopSequence: notice.stopSequence, stopNonce: notice.stopNonce,
            kind: 'unknown' as const, code: 'INPUT_STOP_WRITE_UNKNOWN'}
        }
      })
    }
    const onBlocked = (notice: NativeInputBlocked) => {
      if (!hot || !continuation.ownsRefs(notice.refs)&&!notice.refs.some(ref => hot!.refs.some(owned => equal(ref, owned)))) return
      continuation.close()
      terminal?.revoke()
      revoked = true
      pendingRevocations.add(hot.preparationId)
      hot.status = 'unknown'
      hot.stop ??= {status: 'unknown', code: notice.code}
      const target = hot
      void enqueue(() => save(target)).catch(report)
    }
    const hook: NativeInputAdmissionHookV2 = {
      schemaVersion: 2,
      onContinuationControl:control=>continuation.setControl(control),
      recognizeSupplement:input=>continuation.recognize(input),
      async admit(proposal, signal, existing) {
        if (!live || signal.aborted || existing) return blocked(existing ? 'INPUT_COLD_RECOVERY_DISABLED' : 'INPUT_PERMISSION_REVOKED')
        if (!proposal.refs.length || proposal.refs.some(ref => ref.sessionId !== sid)) return blocked('INPUT_REFS_INVALID')
        if (!Number.isSafeInteger(boundSeq) || proposal.refs.some(ref => ref.insertSeq <= boundSeq)) return blocked('INPUT_PREEXISTING_REFS_UNKNOWN')
        return enqueue(async () => {
          if (!live || signal.aborted) return blocked('INPUT_PERMISSION_REVOKED')
          // Scan owned immutable records, rather than trusting a potentially
          // lost index/current write. The same refs never acquire a new key.
          const previous = records(sid)
          if ([...table.entries()].some(([recordKey, value]) => recordKey.startsWith(`${prefix(sid)}work-`)
            && !isWork(value, sid))) return blocked('INPUT_STORED_WORK_UNKNOWN')
          const stopped = [...table.entries()].some(([recordKey, value]) => {
            if (!recordKey.startsWith(`${prefix(sid)}stop-`)) return false
            const row = value as {refs?: NativeInputRef[]; notice?: NativeInputStopNoticeV1}
            return !Array.isArray(row?.refs) || row.notice?.refsCode && !row.refs.length
              || row.refs.some(ref => proposal.refs.some(item => equal(ref, item)))
          })
          if (stopped) return blocked('INPUT_STOPPED_REFS')
          if (table.get(workKey(sid, proposal.refs)) || previous.some(work => work.refs.some(ref => proposal.refs.some(item => equal(ref, item))))) {
            return blocked('INPUT_EXISTING_WORK_UNKNOWN')
          }
          const terminalGate=readTerminalAdmissionGate(sid,previous)
          if(terminalGate.kind==='blocked')return terminalGate
          const actualSource = observeExact(agent.session)
          // The fixed installed Harness may still advertise admission v2
          // without completed-work support. Fail before acquiring numerical
          // input authority rather than silently omitting its terminal gate.
          if(completion&&actualSource.kind==='story'&&actualSource.headRef
            &&typeof agent.lookupInputCompletion!=='function')return blocked('INPUT_COMPLETION_CAPABILITY_MISSING')
          const inputSource: InputObservation = actualSource.kind !== 'legacy'
            && !proposal.messages.some(message => message.source?.kind === 'user')
            ? {kind: 'management', sourceSha256: actualSource.sourceSha256, reason: 'INTERNAL_NATIVE_INPUT'} : actualSource
          const terminalRequired=completion&&inputSource.kind==='story'&&inputSource.headRef?true:undefined
          const identity = {schemaVersion: 2 as const, namespace: ROLEPLAY_INPUT_NAMESPACE, sessionId: sid,
            branchId: sid, preparationId: randomUUID(), receiptGeneration: Math.max(0, ...previous.map(work => work.receiptGeneration)) + 1,
            refs: clone(proposal.refs),...(terminalRequired?{terminalRequired:true as const}:{})} as const
          const credentialSha256 = digest(identity)
          const work: Work = {...identity, credentialSha256, preparation: {schemaVersion: 1,
            namespace: ROLEPLAY_INPUT_NAMESPACE, preparationKeySha256: digest({sessionId: sid, preparationId: identity.preparationId}),
            credentialSha256}, status: 'created', source: inputSource, attemptGeneration: 0}
          continuation.close()
          hot = work; revoked = false; claim = undefined; currentStep = undefined; currentLease = undefined
          try {
            await save(work)
            if (signal.aborted || revoked || !live) return refuseUnclaimed(work,'INPUT_PERMISSION_REVOKED')
            await table.put(currentKey(sid), {schemaVersion: 2, preparationId: work.preparationId, credentialSha256})
            if (signal.aborted || revoked || baseCurrency(work)) return refuseUnclaimed(work,'INPUT_PERMISSION_REVOKED')
            return {kind: 'allow' as const, identity: work, preparation: clone(work.preparation),
              ...(work.source.kind==='story'?{ownedContinuations:true as const}:{}),
              ...(work.terminalRequired?{completedWorkRequired:true as const}:{})}
          } catch (error) {revoked = true; report(error); return refuseUnclaimed(work,'INPUT_CREATION_WRITE_UNKNOWN')}
        })
      },
      check(input) {
        if (!hot || input.identity !== hot || !equal(input.preparation, hot.preparation)
          || !equal(input.claim.refs, hot.refs) || !equal(input.claim.proposal, input.proposal)) return blocked('INPUT_IDENTITY_CHANGED')
        const code = baseCurrency(hot)
        if (code) {continuation.close();return blocked(code)}
        if (input.supplement) {
          if (!hot.checkpoint || !equal(input.supplement.parent,hot.checkpoint)) return blocked('INPUT_CONTINUATION_PARENT_CHANGED')
          const result=continuation.check(input.supplement)
          if(result.kind==='blocked')return result
        }
        claim = input.claim
        // Native invokes check before Core pre-step and before its first flush.
        // This is preparation authority, not provider readiness.
        if (!input.receipt) return allowed
        if (!equal(input.receipt, hot.checkpoint) || !hot.attempt?.prepared
          || hot.attempt.turn !== input.claim.turn) return blocked('INPUT_NOT_PREPARED')
        return allowed
      },
      async checkpoint(receipt, signal) {
        const work = hot
        if (!work || signal.aborted || !claim || !equal(receipt.preparation, work.preparation)
          || !equal(receipt.refs, work.refs) || receipt.actualTurn !== claim.turn
          || !equal(receipt.claimSpliceSeqs, claim.spliceSeqs)) return blocked('INPUT_CHECKPOINT_INVALID')
        // Native's public durable lookup intentionally requires a closed latest
        // turn. Its checkpoint callback instead supplies the flushed live
        // association; match actual events without inventing a turn or seq.
        if (!checkpointAssociation(receipt)) return blocked('INPUT_CHECKPOINT_UNPROVEN')
        return enqueue(async () => {
          const code = baseCurrency(work)
          if (signal.aborted || code || !work.attempt?.prepared) return blocked(code ?? 'INPUT_NOT_PREPARED')
          work.checkpoint = clone(receipt); work.status = 'active'
          try {await save(work)} catch (error) {revoked = true; report(error); return blocked('INPUT_CHECKPOINT_WRITE_UNKNOWN')}
          if (signal.aborted || revoked || baseCurrency(work)) return blocked('INPUT_PERMISSION_REVOKED')
          lifecycle.set(work.preparationId, {identity: clone(identityOf(work)), receipt: clone(receipt)})
          return allowed
        })
      },
      onStop: stop,
      onBlocked,
      ...(terminal?{completedWork:terminal.complete}:{}),
    }
    const unregister = agent.registerInputAdmission(hook)
    const binding: RoleplayInputBinding = {
      async beginStep({turn, step, signal, legacyPreparationId}: {
        turn: number; step: number; signal: AbortSignal; legacyPreparationId?: string
      }): Promise<RoleplayInputStep> {
        const work = hot
        if (!work || !claim || claim.turn !== turn || signal.aborted || !Number.isSafeInteger(step) || step < 1) fail('INPUT_NO_CURRENT_CLAIM')
        return enqueue(async () => {
          const code = baseCurrency(work)
          if (code || signal.aborted) fail(code ?? 'INPUT_PERMISSION_REVOKED')
          const continuesAttempt = work.attempt?.turn === turn && step > work.attempt.step && work.attempt.prepared
          if (continuesAttempt) work.attempt = {...work.attempt!, step}
          else {
            work.attemptGeneration++
            work.attempt = {turn, step, prepared: false, ...(legacyPreparationId ? {legacyPreparationId} : {})}
          }
          await save(work)
          if (baseCurrency(work) || signal.aborted) fail('INPUT_PERMISSION_REVOKED')
          const token: RoleplayInputStep = Object.freeze({kind: continuation.isMaintenance() ? 'maintenance'
            : work.transition?.status === 'legacy-delegated' ? 'legacy'
            : work.transition ? 'management' : work.source.kind, currency: Object.freeze({schemaVersion: 2 as const,
            preparationId: work.preparationId, credentialSha256: work.credentialSha256,
            receiptGeneration: work.receiptGeneration, attemptGeneration: work.attemptGeneration, source: clone(work.source)})})
          steps.set(token, {work, generation: work.attemptGeneration, signal})
          currentStep = token
          return token
        })
      },
      checkCurrency(step: RoleplayInputStep) {const code = stepCurrency(step); return code ? blocked(code) : allowed},
      async prepare(step: RoleplayInputStep, snapshot?: InputPreparationSnapshotRef) {
        return enqueue(async () => {
          const code = stepCurrency(step)
          if (code) fail(code)
          const work = steps.get(step)!.work
          const story = work.source.kind === 'story' && !work.transition
          if (story && (!snapshot || !sha(snapshot.sha256) || !snapshot.key)) fail('INPUT_STORY_SNAPSHOT_MISSING')
          if (!story && snapshot) fail('INPUT_MANAGEMENT_SNAPSHOT_FORBIDDEN')
          work.attempt = {...work.attempt!, prepared: true, ...(snapshot ? {snapshot: clone(snapshot)} : {})}
          if (!story) delete work.attempt.snapshot
          await save(work)
          if (stepCurrency(step)) fail('INPUT_PERMISSION_REVOKED')
          return {...clone(step.currency), ...(snapshot ? {snapshot: clone(snapshot)} : {})}
        })
      },
      checkSnapshot(currency: InputPreparationCurrency) {
        if (!hot || baseCurrency(hot) || !hot.checkpoint || !hot.attempt?.prepared
          || !equal(currency, {schemaVersion: 2, preparationId: hot.preparationId, credentialSha256: hot.credentialSha256,
            receiptGeneration: hot.receiptGeneration, attemptGeneration: hot.attemptGeneration, source: hot.source,
            ...(hot.attempt.snapshot ? {snapshot: hot.attempt.snapshot} : {})})) return blocked('INPUT_SNAPSHOT_STALE')
        return hot.source.kind === 'story' && !hot.transition ? allowed : blocked('INPUT_STORY_AUTHORITY_ABSENT')
      },
      checkAttempt(currency: InputPreparationCurrency) {
        const current = binding.persistedCurrency()
        if (hot?.transition && currency.source.kind === 'story') return blocked('INPUT_STORY_AUTHORITY_ABSENT')
        if (!hot || baseCurrency(hot) || !current || currency.schemaVersion !== 2 || currency.preparationId !== current.preparationId
          || currency.credentialSha256 !== current.credentialSha256 || currency.receiptGeneration !== current.receiptGeneration
          || currency.attemptGeneration !== current.attemptGeneration || !equal(currency.source, current.source)) {
          return blocked('INPUT_ATTEMPT_CHANGED')
        }
        return allowed
      },
      checkHistoricalTaskCurrency(currency: InputPreparationCurrency) {
        const result = historical(currency)
        return result.code ? blocked(result.code) : allowed
      },
      checkHistoricalSnapshot(currency: InputPreparationCurrency) {
        const result = historical(currency)
        return result.code ? blocked(result.code) : equal(currency, currencyOf(result.work!)) && !!result.work!.attempt?.snapshot
          ? allowed : blocked('HISTORICAL_SNAPSHOT_CHANGED')
      },
      historicalCurrency(currency: InputPreparationCurrency) {
        const result = historical(currency)
        return result.work ? currencyOf(result.work) : undefined
      },
      persistedCurrency() {
        if (!hot || !hot.attempt || baseCurrency(hot)) return undefined
        return currencyOf(hot)
      },
      currentStep() {return currentStep && !stepCurrency(currentStep) ? currentStep : undefined},
      existingTransition() {
        return hot?.transition && currentLease && !baseCurrency(hot)
          ? {lease: currentLease, proof: clone(hot.transition.reservation.proof)} : undefined
      },
      originalMessages(step: RoleplayInputStep) {
        const code = stepCurrency(step)
        if (code || !claim || !equal(claim.refs, hot?.refs)) fail(code ?? 'INPUT_NO_CURRENT_CLAIM')
        return claim.messages
      },
      steerOwnedContinuation(message,turn) {
        return continuation.steer(message as unknown as Parameters<typeof continuation.steer>[0],turn)
      },
      /** Root supplies a verified actual open Native call before its first await. */
      beginTransition(step: RoleplayInputStep, actualCall: {callId: string; playerRef: NativeInputRef}) {
        const code = stepCurrency(step)
        if (code) fail(code)
        if(step.kind==='maintenance')fail('INPUT_MAINTENANCE_TRANSITION_FORBIDDEN')
        continuation.close()
        const work = steps.get(step)!.work
        if (work.transition || !work.refs.some(ref => equal(ref, actualCall.playerRef)) || !actualCall.callId) fail('INPUT_TRANSITION_INVALID')
        const partialProof: InputTransitionProof = {...clone(actualCall), sourceProofSha256: '', channel: 'chat-attachment', requestId: '',
          sourceSha256: work.source.sourceSha256, rawSourceSha256: ''}
        const reservation = Object.freeze({reservationId: randomUUID(), preparationId: work.preparationId, proof: partialProof})
        work.transition = {reservation, from: clone(work.source), status: 'revoked'}
        work.attempt = {...work.attempt!, prepared: false}
        delete work.attempt.snapshot
        reservations.set(reservation, {work, step})
        const assertLease = () => {
          if (hot !== work || revoked || !live || work.stop || steps.get(step)!.signal.aborted) fail('INPUT_PERMISSION_REVOKED')
        }
        const assertLegacyLease = () => {
          if (!live || work.stop || steps.get(step)!.signal.aborted || observeExact(agent.session).kind !== 'legacy') {
            fail('INPUT_LEGACY_PERMISSION_REVOKED')
          }
        }
        const persist = async () => {
          try {await save(work)} catch (error) {revoked = true; report(error); fail('INPUT_TRANSITION_WRITE_UNKNOWN')}
          assertLease()
        }
        // Persist revocation even if source resolution fails before reserve.
        const revokedWrite = enqueue(persist)
        void revokedWrite.catch(report)
        const lease: RoleplayInputTransitionLease = {
          reservationId: reservation.reservationId,
          async reserve(proof: InputTransitionProof) {
            await revokedWrite
            return enqueue(async () => {
              assertLease()
              if (work.transition!.status !== 'revoked') {
                if (!equal(work.transition!.reservation.proof, proof)) fail('INPUT_SECOND_TRANSITION_REJECTED')
                return
              }
              if (proof.callId !== actualCall.callId
                || !equal(proof.playerRef, actualCall.playerRef) || !sha(proof.sourceProofSha256)
                || !['chat-attachment', 'workspace'].includes(proof.channel)
                || !sha(proof.rawSourceSha256) || !proof.requestId
                || proof.sourceSha256 !== work.source.sourceSha256) fail('INPUT_TRANSITION_INVALID')
              work.transition!.reservation = {...reservation, proof: clone(proof)}
              work.transition!.status = 'reserved'
              await persist()
              reservationLeases.set(reservation.reservationId, lease)
            })
          },
          bindJob(job: InputTransitionJob) {
            return enqueue(async () => {
              assertLease()
              if (work.transition!.status !== 'reserved') {
                if (!equal(work.transition!.job, job)) fail('INPUT_TRANSITION_JOB_INVALID')
                return
              }
              if (!job.jobId || !boundedId(job.jobGeneration)
                || job.requestId !== work.transition!.reservation.proof.requestId
                || job.rawSourceSha256 !== work.transition!.reservation.proof.rawSourceSha256) fail('INPUT_TRANSITION_JOB_INVALID')
              work.transition!.job = clone(job); work.transition!.status = 'job-bound'
              await persist()
              leases.set(`${sid}:${job.jobId}:${job.jobGeneration}`, lease)
            })
          },
          prepareActivation(proof: InputTransitionActivationProof) {
            return enqueue(async () => {
              if (work.transition!.status === 'legacy-delegated') {assertLegacyLease(); return}
              assertLease()
              // Copy the declared reservation fields only. A caller may pass
              // an activation DTO that additionally carries the future Source;
              // that mutable observation is never part of this prepared proof.
              const preparedProof: InputTransitionActivationProof = {importId: proof.importId,
                transactionId: proof.transactionId, oldPointerSha256: proof.oldPointerSha256,
                writeDigests: clone(proof.writeDigests)}
              if (['activation-prepared', 'committed'].includes(work.transition!.status)) {
                if (!equal(work.transition!.activationProof, preparedProof)) fail('INPUT_SECOND_TRANSITION_REJECTED')
                return
              }
              if (work.transition!.status !== 'job-bound' || !proof.importId || !proof.transactionId
                || !recordDigest(proof.oldPointerSha256) || !Object.keys(proof.writeDigests).length
                || Object.values(proof.writeDigests).some(value => !recordDigest(value))) fail('INPUT_ACTIVATION_INVALID')
              work.transition!.activationProof = preparedProof; work.transition!.status = 'activation-prepared'
              await persist()
            })
          },
          checkActivation() {
            if (work.transition!.status === 'legacy-delegated') {assertLegacyLease(); return}
            assertLease()
            if (!['activation-prepared', 'committed'].includes(work.transition!.status)
              || !work.transition!.job || !work.transition!.activationProof) fail('INPUT_ACTIVATION_UNPROVEN')
          },
          getActivationProof() {return clone(work.transition?.activationProof)},
          isLegacy() {return work.transition?.status === 'legacy-delegated'},
          rejectSource(code = 'IMPORT_SOURCE_REJECTED') {
            return enqueue(async () => {
              assertLease()
              const transition = work.transition!
              if (!['revoked', 'reserved'].includes(transition.status) || transition.job || transition.activationProof
                || !equal(observeExact(agent.session), transition.from) || !/^[A-Z][A-Z0-9_]{0,63}$/.test(code)) {
                fail('INPUT_SOURCE_REJECTION_UNPROVEN')
              }
              transition.status = 'source-rejected'
              work.source = {kind: 'management', sourceSha256: transition.from.sourceSha256, reason: code}
              work.attempt = {...work.attempt!, prepared: true}
              delete work.attempt.snapshot
              await persist()
            })
          },
          delegateLegacy(proof: InputTransitionProof,merge?:InputLegacyMergeReference) {
            return enqueue(async () => {
              assertLease()
              const transition = work.transition!, actual = observeExact(agent.session)
              if (!['reserved', 'job-bound'].includes(transition.status) || !equal(proof, transition.reservation.proof)
                || actual.kind !== 'legacy' || actual.reason !== 'LEGACY_SEMANTIC_IMPORT') fail('INPUT_LEGACY_DELEGATION_INVALID')
              if(merge&&(transition.job||merge.schemaVersion!==1||merge.kind!=='semantic-merge-source'
                ||!boundedId(merge.importId)||!sha(merge.normalizedSha256)))fail('INPUT_LEGACY_DELEGATION_INVALID')
              if(!transition.job&&!merge)fail('INPUT_LEGACY_HANDOFF_MISSING')
              if(merge)transition.legacyRecord=clone(merge)
              transition.status = 'legacy-delegated'
              work.source = actual
              work.attempt = {...work.attempt!, prepared: true}
              await persist()
            })
          },
          commit(activation: InputTransitionActivation) {return binding.commitTransition(reservation, activation)},
          fail(code: string) {
            revoked = true; work.status = 'unknown'; work.stop ??= {status: 'unknown', code}
            return enqueue(() => save(work)).catch(report)
          },
        }
        currentLease = lease
        return lease
      },
      commitTransition(reservation: RoleplayInputTransitionReservation, activation: InputTransitionActivation) {
        const entry = reservations.get(reservation)
        return enqueue(async () => {
          if (!entry || !sha(activation.sourceSha256) || !equal(entry.work.transition?.activationProof,
            {importId: activation.importId, transactionId: activation.transactionId,
              oldPointerSha256: activation.oldPointerSha256, writeDigests: activation.writeDigests})) {
            return {kind: 'unknown' as const, code: 'INPUT_ACTIVATION_INVALID'}
          }
          const work = entry.work, transition = work.transition!
          if (transition.status === 'committed') {
            return equal(transition.activation, activation) && !work.stop && !revoked ? {kind: 'acknowledged' as const}
              : {kind: 'unknown' as const, code: 'INPUT_SECOND_TRANSITION_REJECTED'}
          }
          // Persist the nested transition through its owning work record.
          // A local transition view is not the writer's durable snapshot.
          work.transition = {...transition, activation: clone(activation)}
          if (hot !== work || !live || entry && steps.get(entry.step)?.signal.aborted) {
            work.stop ??= {status: 'unknown', code: 'INPUT_PERMISSION_REVOKED'}
            work.status = work.stop.status === 'terminal' ? 'stopped' : 'unknown'
          }
          let actual: InputObservation
          try {
            actual = observeExact(agent.session)
            if (actual.sourceSha256 !== activation.sourceSha256) fail('INPUT_ACTIVATION_SOURCE_MISMATCH')
          } catch (error) {
            revoked = true; work.status = 'unknown'; work.transition = {...work.transition, status: 'unknown'}
            work.stop ??= {status: 'unknown', code: 'INPUT_ACTIVATION_SOURCE_UNKNOWN'}
            report(error)
            try {await save(work)} catch (writeError) {report(writeError)}
            return {kind: 'unknown' as const, code: 'INPUT_ACTIVATION_SOURCE_UNKNOWN'}
          }
          work.transition = {...work.transition, status: 'committed', to: clone(actual)}
          work.source = {kind: 'management', sourceSha256: actual.sourceSha256, reason: 'import-transition-ack'}
          // ACK observation must still track actual Source/head, rather than
          // claiming the synthetic management reason is the actual observation.
          work.attempt = {...work.attempt!, prepared: !work.stop && !revoked}
          try {await save(work)} catch (error) {
            revoked = true; work.status = 'unknown'; work.stop ??= {status: 'unknown', code: 'INPUT_TRANSITION_WRITE_UNKNOWN'}
            report(error); return {kind: 'unknown' as const, code: 'INPUT_TRANSITION_WRITE_UNKNOWN'}
          }
          return work.stop || revoked ? {kind: 'unknown' as const, code: 'INPUT_PERMISSION_REVOKED'} : {kind: 'acknowledged' as const}
        })
      },
      current() {
        if (!hot) return undefined
        return {preparationId: hot.preparationId, receiptGeneration: hot.receiptGeneration,
          kind: continuation.isMaintenance() ? 'maintenance' as const : hot.transition?.status === 'legacy-delegated'
            ? 'legacy' as const : hot.transition ? 'management' as const : hot.source.kind,
          status: hot.status, checkpoint: clone(hot.checkpoint), attemptGeneration: hot.attemptGeneration,
          prepared: hot.attempt?.prepared === true, refs: clone(hot.refs), currency: binding.persistedCurrency()}
      },
      dispose() {
        if(!live)return
        live=false
        terminal?.dispose()
        if(terminalOwners.get(sid)===terminal)terminalOwners.delete(sid)
        revoked = true; continuation.close(); currentStep = undefined; unregister(); owners.delete(agent)
        if (hot?.transition) reservationLeases.delete(hot.transition.reservation.reservationId)
        if (sessionOwners.get(sid) === agent) sessionOwners.delete(sid)
        for (const leaseKey of leases.keys()) if (leaseKey.startsWith(`${sid}:`)) leases.delete(leaseKey)
      },
    }
    owners.set(agent, binding)
    return binding
  }
  const api = {
    bind,
    readTerminalAdmissionGate:(sessionId:string)=>readTerminalAdmissionGate(sessionId),
    checkTerminalPermission(token:object,intent:MvuStateTerminalIntent):boolean {
      return terminalOwners.get(intent.sessionId)?.checkPermission(token,intent)===true
    },
    /** Stored intent is a factual association, not a cold permission token. */
    verifyTerminalIntent(intent:MvuStateTerminalIntent):boolean {
      try {
        const row=readInputCompletion(table,intent.sessionId,intent.preparationId)
        const matches=records(intent.sessionId).filter(work=>work.preparationId===intent.preparationId)
        if(!row||row.plan.kind!=='numerical'||!equal(row.plan.intent,intent)||matches.length!==1)return false
        const work=matches[0]!
        return work.terminalRequired===true&&equal(work.checkpoint,row.scope.receipt.checkpoint)
          &&equal(currencyOfStored(work),row.scope.currency)&&equal(work.refs,row.scope.receipt.checkpoint.refs)
          &&completion?.verifyStored(row.scope,intent)===true
      } catch {return false}
    },
    /** Driver inherits the actual chat reservation through exact job identity.
     * Cold handles can only record an already proven activation; they cannot
     * prepare a new switch, authorize ACK/story, wake or repeat the input. */
    transitionForJob(sessionId: string, jobId: string, jobGeneration: string): RoleplayInputTransitionLease | undefined {
      const hotLease = leases.get(`${sessionId}:${jobId}:${jobGeneration}`)
      if (hotLease) return hotLease
      const matches = records(sessionId).filter(work => work.transition?.job?.jobId === jobId
        && work.transition.job.jobGeneration === jobGeneration)
      if (matches.length !== 1) return undefined
      const initial = matches[0]!, reservationId = initial.transition!.reservation.reservationId
      const unavailable = () => Promise.reject(new Error('INPUT_COLD_TRANSITION_UNKNOWN'))
      return {
        reservationId,
        reserve: unavailable,
        bindJob: unavailable,
        prepareActivation: unavailable,
        delegateLegacy: unavailable,
        checkActivation() {fail('INPUT_COLD_TRANSITION_UNKNOWN')},
        getActivationProof() {return clone(initial.transition?.activationProof)},
        isLegacy() {return initial.transition?.status === 'legacy-delegated'},
        rejectSource: unavailable,
        fail(code) {
          return enqueue(async () => {
            const value = table.get(workKey(sessionId, initial.refs))
            if (!isWork(value, sessionId)) fail('INPUT_COLD_WORK_UNKNOWN')
            const work = clone(value)
            work.status = 'unknown'; work.stop ??= {status: 'unknown', code}
            await table.put(workKey(sessionId, work.refs), work)
          }).catch(report)
        },
        commit(activation) {
          return enqueue(async () => {
            const value = table.get(workKey(sessionId, initial.refs))
            if (!isWork(value, sessionId)) return {kind: 'unknown' as const, code: 'INPUT_COLD_WORK_UNKNOWN'}
            const work = clone(value), transition = work.transition
            if (!transition || transition.reservation.reservationId !== reservationId
              || !equal(transition.activationProof, {importId: activation.importId, transactionId: activation.transactionId,
                oldPointerSha256: activation.oldPointerSha256, writeDigests: activation.writeDigests})
              || !sha(activation.sourceSha256) || transition.activation && !equal(transition.activation, activation)) {
              return {kind: 'unknown' as const, code: 'INPUT_COLD_ACTIVATION_UNPROVEN'}
            }
            transition.activation = clone(activation); transition.status = 'committed'
            work.status = 'unknown'; work.stop ??= {status: 'unknown', code: 'INPUT_COLD_AUTHORITY_ABSENT'}
            try {
              await table.put(workKey(sessionId, work.refs), work)
              if (!equal(table.get(workKey(sessionId, work.refs)), work)) fail('INPUT_WRITE_UNCONFIRMED')
            } catch (error) {report(error); return {kind: 'unknown' as const, code: 'INPUT_TRANSITION_WRITE_UNKNOWN'}}
            return {kind: 'unknown' as const, code: 'INPUT_COLD_AUTHORITY_ABSENT'}
          })
        },
      }
    },
    transitionForRequest(sessionId: string, requestId: string, rawSourceSha256: string): RoleplayInputTransitionLease | undefined {
      const matches = records(sessionId).filter(work => work.transition?.reservation.proof.requestId === requestId
        && work.transition.reservation.proof.rawSourceSha256 === rawSourceSha256)
      if (matches.length !== 1) return undefined
      const transition = matches[0]!.transition!
      const hotLease = reservationLeases.get(transition.reservation.reservationId)
      if (hotLease) return hotLease
      return transition.job ? api.transitionForJob(sessionId, transition.job.jobId, transition.job.jobGeneration) : undefined
    },
  }
  return api
}
