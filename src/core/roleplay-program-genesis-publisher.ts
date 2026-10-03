/** Existing-table append-only publisher. Await actual write completion while
 * holding the shared Source FIFO; cancellation never releases a live writer. */
import {mvuInitializationEventKey,mvuInitializationHeadKey} from './roleplay-mvu-initialization.js'
import {cloneProgramGenesisDataV1,validateFrozenProgramMvuOpeningPlanV3,
  validateProgramGenesisNativeEnvelopeV1,createProgramMvuGenesisEventV1,
  validateProgramMvuGenesisFactsV1,programGenesisEventIdV1,programGenesisHeadForV1,
  programGenesisSameV1,ProgramGenesisDataFailureV1} from './roleplay-program-genesis-data.js'
import type {FrozenProgramMvuOpeningPlanV3,ProgramGenesisNativeEnvelopeV1,
  ProgramMvuGenesisEventV1,ProgramMvuGenesisHeadV1,ProgramGenesisPublicationV1,
  ProgramGenesisPublisherDepsV1} from './roleplay-program-genesis-types.js'

export interface ProgramGenesisClosingPublicationInputV1 {
  readonly plan:FrozenProgramMvuOpeningPlanV3
  /** Actual owner passes its already flushed completed Native facts. */
  readonly native:ProgramGenesisNativeEnvelopeV1
  readonly signal:AbortSignal
}
const blocked=(code:string):ProgramGenesisPublicationV1=>({kind:'blocked',code})
const unknown=(code:string):ProgramGenesisPublicationV1=>({kind:'unknown',code})
const failureCode=(error:unknown)=>error instanceof ProgramGenesisDataFailureV1?error.code:'PROGRAM_GENESIS_RECORD_INVALID'
export function createProgramMvuGenesisPublisherV1(deps:ProgramGenesisPublisherDepsV1) {
  for(const required of ['withSourceLock','isSourceCurrent','isOpeningCurrent','isBasisCurrent','isHistoricalBasisCurrent',
    'isNativeCurrent','lookupNative'] as const) {
    if(typeof deps[required]!=='function')throw new Error('PROGRAM_GENESIS_OWNER_DEPENDENCY_REQUIRED')
  }
  function ownerCurrent(plan:FrozenProgramMvuOpeningPlanV3,native:ProgramGenesisNativeEnvelopeV1,
    signal?:AbortSignal):ProgramGenesisPublicationV1|undefined {
    if(signal?.aborted)return unknown('PROGRAM_GENESIS_CANCELLED')
    if(!deps.isSourceCurrent(plan))return blocked('PROGRAM_GENESIS_SOURCE_CHANGED')
    if(!deps.isOpeningCurrent(plan,native))return blocked('PROGRAM_GENESIS_INTENT_CHANGED')
    if(!deps.isNativeCurrent(plan,native))return blocked('PROGRAM_GENESIS_NATIVE_CHANGED')
  }
  function current(plan:FrozenProgramMvuOpeningPlanV3,native:ProgramGenesisNativeEnvelopeV1,
    event:ProgramMvuGenesisEventV1,head:ProgramMvuGenesisHeadV1,signal?:AbortSignal):ProgramGenesisPublicationV1|undefined {
    const unavailable=ownerCurrent(plan,native,signal)
    if(unavailable)return unavailable
    if(!deps.isBasisCurrent(plan,native,event,head))return blocked('PROGRAM_GENESIS_BASIS_CHANGED')
  }
  function proposal(plan:FrozenProgramMvuOpeningPlanV3,native:ProgramGenesisNativeEnvelopeV1):
    {event:ProgramMvuGenesisEventV1;head:ProgramMvuGenesisHeadV1}|ProgramGenesisPublicationV1 {
    const eventKey=mvuInitializationEventKey(plan.identity.sessionId,programGenesisEventIdV1(plan)),
      stored=deps.table.get(eventKey)
    if(stored!==undefined) {
      // A lost head/ACK preserves the historical parser version. Never rerun
      // fallback selection and replace a committed event with today's choice.
      try {
        const event=cloneProgramGenesisDataV1(stored) as ProgramMvuGenesisEventV1,head=programGenesisHeadForV1(event),
          facts=validateProgramMvuGenesisFactsV1(event,head)
        if(!programGenesisSameV1(facts.programEvent.plan,plan)||!programGenesisSameV1(facts.programEvent.native,native)) {
          return blocked('PROGRAM_GENESIS_IDENTITY_CONFLICT')
        }
        return {event:facts.programEvent,head:facts.programHead}
      }catch(error){return blocked(failureCode(error))}
    }
    try {
      const event=createProgramMvuGenesisEventV1(plan,native)
      return {event,head:programGenesisHeadForV1(event)}
    }catch(error){return blocked(failureCode(error))}
  }
  /** put may throw after committing. Exact acknowledged readback is the only
   * recovery; a pending promise is always awaited and never raced with abort. */
  async function writeExact(key:string,value:ProgramMvuGenesisEventV1|ProgramMvuGenesisHeadV1):Promise<boolean> {
    try {await deps.table.put(key,cloneProgramGenesisDataV1(value))}catch {
      return programGenesisSameV1(deps.table.get(key),value)
    }
    return programGenesisSameV1(deps.table.get(key),value)
  }
  async function publishLocked(plan:FrozenProgramMvuOpeningPlanV3,native:ProgramGenesisNativeEnvelopeV1,
    signal:AbortSignal):Promise<ProgramGenesisPublicationV1> {
    // These suppliers must reread actual owner/current facts after acquisition.
    // Pure hash verification alone does not authorize even a pre-existing row.
    const selected=proposal(plan,native)
    if('kind' in selected)return selected
    const {event,head}=selected,check=()=>current(plan,native,event,head,signal),early=check()
    if(early)return early
    const eventKey=mvuInitializationEventKey(plan.identity.sessionId,event.eventId),
      headKey=mvuInitializationHeadKey(plan.identity.sessionId),existingHead=deps.table.get(headKey)
    // Any previous protocol/revision belongs to its owner. No upgrade/rollback
    // is inferred from an otherwise valid new frozen plan.
    if(existingHead!==undefined&&!programGenesisSameV1(existingHead,head))return blocked('PROGRAM_GENESIS_HEAD_CONFLICT')
    const storedEvent=deps.table.get(eventKey)
    if(storedEvent!==undefined&&!programGenesisSameV1(storedEvent,event))return blocked('PROGRAM_GENESIS_EVENT_CONFLICT')
    if(storedEvent===undefined&&!await writeExact(eventKey,event))return unknown('PROGRAM_GENESIS_EVENT_WRITE_UNACKNOWLEDGED')
    if(!programGenesisSameV1(deps.table.get(eventKey),event))return unknown('PROGRAM_GENESIS_EVENT_READBACK_CHANGED')
    const afterEvent=check()
    if(afterEvent)return afterEvent
    const headNow=deps.table.get(headKey)
    if(headNow!==undefined&&!programGenesisSameV1(headNow,head))return blocked('PROGRAM_GENESIS_HEAD_CONFLICT')
    if(headNow===undefined&&!await writeExact(headKey,head))return unknown('PROGRAM_GENESIS_HEAD_WRITE_UNACKNOWLEDGED')
    if(!programGenesisSameV1(deps.table.get(headKey),head)
      ||!programGenesisSameV1(deps.table.get(eventKey),event))return unknown('PROGRAM_GENESIS_FINAL_READBACK_CHANGED')
    const afterHead=check()
    if(afterHead)return afterHead
    return {kind:'ready',genesis:validateProgramMvuGenesisFactsV1(deps.table.get(eventKey),deps.table.get(headKey))}
  }
  async function publishFromClosing(input:ProgramGenesisClosingPublicationInputV1):Promise<ProgramGenesisPublicationV1> {
    const plan=validateFrozenProgramMvuOpeningPlanV3(input.plan),
      native=validateProgramGenesisNativeEnvelopeV1(input.native,plan)
    if(input.signal.aborted)return unknown('PROGRAM_GENESIS_CANCELLED')
    // No lookup, flush or whenIdle: this caller is the running closing driver.
    return deps.withSourceLock(plan.identity.sessionId,()=>publishLocked(plan,native,input.signal))
  }
  async function publish(input:{readonly plan:FrozenProgramMvuOpeningPlanV3;
    readonly signal:AbortSignal}):Promise<ProgramGenesisPublicationV1> {
    const plan=validateFrozenProgramMvuOpeningPlanV3(input.plan)
    if(input.signal.aborted)return unknown('PROGRAM_GENESIS_CANCELLED')
    if(!deps.isSourceCurrent(plan))return blocked('PROGRAM_GENESIS_SOURCE_CHANGED')
    const found=await deps.lookupNative(plan)
    if(input.signal.aborted)return unknown('PROGRAM_GENESIS_CANCELLED')
    if(found.status!=='committed')return found.status==='unknown'?unknown('PROGRAM_GENESIS_NATIVE_UNKNOWN')
      :blocked('PROGRAM_GENESIS_NATIVE_NOT_COMMITTED')
    const native=validateProgramGenesisNativeEnvelopeV1(found.native,plan)
    return deps.withSourceLock(plan.identity.sessionId,()=>publishLocked(plan,native,input.signal))
  }
  function read(suppliedPlan:FrozenProgramMvuOpeningPlanV3):ProgramGenesisPublicationV1 {
    try {
      const plan=validateFrozenProgramMvuOpeningPlanV3(suppliedPlan),sid=plan.identity.sessionId,
        event=deps.table.get(mvuInitializationEventKey(sid,programGenesisEventIdV1(plan))),
        head=deps.table.get(mvuInitializationHeadKey(sid))
      if(event===undefined)return blocked('PROGRAM_GENESIS_EVENT_MISSING')
      if(head===undefined)return blocked('PROGRAM_GENESIS_HEAD_MISSING')
      const genesis=validateProgramMvuGenesisFactsV1(event,head)
      if(!programGenesisSameV1(genesis.programEvent.plan,plan))return blocked('PROGRAM_GENESIS_IDENTITY_CONFLICT')
      const unavailable=ownerCurrent(plan,genesis.programEvent.native)
      if(unavailable)return unavailable
      // Committed genesis remains the original revision-1 root after ordinary
      // story/manual rows appear. Verify its historical basis/span rather than
      // extending the publisher's sole exact-event/head fresh exemptions.
      if(!deps.isHistoricalBasisCurrent(plan,genesis.programEvent.native,genesis.programEvent,genesis.programHead)) {
        return blocked('PROGRAM_GENESIS_HISTORICAL_BASIS_CHANGED')
      }
      return {kind:'ready',genesis}
    }catch(error){return blocked(failureCode(error))}
  }
  return {publish,publishFromClosing,read}
}
