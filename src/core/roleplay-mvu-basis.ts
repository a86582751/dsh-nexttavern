import {recordSha256} from './roleplay-data.js'
import {eventsOf} from './roleplay-context.js'
import {mvuInitializationEventKey, mvuInitializationHeadKey} from './roleplay-mvu-initialization.js'
import type {ReadBranchSession} from './roleplay-worldline-types.js'
import type {FreshNativeBasisFacts, MvuSourceSnapshot} from './roleplay-mvu-source.js'
import type {
  FrozenMvuOpeningInitializationV2, MvuInitializationEvent, MvuInitializationHead, MvuNativeOpeningReceipt,
} from './roleplay-mvu-initialization.js'

interface BasisTable {get(key:string):unknown; entries():Iterable<[string,unknown]>}
export interface MvuBasisDependencies {
  branch:BasisTable
  numerical:BasisTable
  session(sessionId:string):ReadBranchSession | undefined
  branchReady(sessionId:string):boolean
  nativeCurrent(receipt:MvuNativeOpeningReceipt):boolean
}
const same = (a:unknown,b:unknown) => recordSha256(a) === recordSha256(b)
const object = (value:unknown):value is Record<string,unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const opening = (event:ReturnType<typeof eventsOf>[number]) => {
  const source = event.data?.message?.source as {kind?:unknown;producer?:unknown;origin?:unknown} | undefined
  return event.type === 'assistant/message' && source?.kind === 'programmatic'
    && source.producer === 'dsh-nexttavern' && typeof source.origin === 'string' && source.origin.startsWith('card-opening:')
}

/** Owns the first numerical authority. Historical messages are never interpreted as an empty MVU value. */
export function createRoleplayMvuBasis(deps:MvuBasisDependencies) {
  function root(sessionId:string) {
    const session = deps.session(sessionId)
    const metaKey = `${sessionId}__meta`
    const meta = deps.branch.get(metaKey)
    if (!session || !deps.branchReady(sessionId) || !object(meta)
      || session.header?.parentSession || !Number.isSafeInteger(session.inheritedEventCount)
      || session.inheritedEventCount !== 0 || meta.inheritedFrom || meta.freshBranchFrom
      || meta.truncatedFrom || meta.inheritanceState && meta.inheritanceState !== 'ready') return null
    return {session,metaKey,metaSha256:recordSha256(meta)}
  }
  function rows(sessionId:string) {
    const prefix = `${sessionId}__mvu-`
    // Every numerical-owner row counts, including unknown versions. A future
    // update authority cannot be silently ignored by initialization replay.
    return [...deps.numerical.entries()].filter(([key]) => key.startsWith(prefix)).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0)
  }
  function fresh(sessionId:string, swipes:MvuSourceSnapshot['swipes']):
    {kind:'fresh';facts:FreshNativeBasisFacts} | {kind:'unknown' | 'not-fresh'} {
    try {
      const owner = root(sessionId)
      if (!owner) return {kind:'unknown'}
      const numericalRows = rows(sessionId)
      const events = eventsOf(owner.session)
      if (numericalRows.length || events.some(opening)) return {kind:'not-fresh'}
      // Capture original full events at a fixed cut. Appending this opening
      // later must not change the preceding proof or produce a new empty basis.
      const observedThroughSeq = events.at(-1)?.seq ?? -1
      if (!Number.isSafeInteger(observedThroughSeq) || events.some((event,index) => event.seq !== index)) return {kind:'unknown'}
      return {kind:'fresh',facts:{schemaVersion:1,encoding:'native-mvu-fresh-basis-facts-v1',
        sessionId,ownerSessionId:sessionId,
        branch:{metaKey:owner.metaKey,metaSha256:owner.metaSha256,inheritance:'root',parentSessionId:null,
          inheritedPrefixLength:0,ready:true},
        numerical:{headKey:mvuInitializationHeadKey(sessionId),headExists:false,
          eventMembershipSha256:recordSha256([]),eventCount:0,opaqueStateExists:false},
        native:{observedThroughSeq,historyVersionSha256:recordSha256(events),committedOpeningCount:0,inheritedMessageCount:0},
        basis:{bookStatData:{},swipes:swipes.map(swipe => ({identity:swipe.identity,sourceSha256:swipe.sourceSha256,statData:{}}))}}}
    } catch {return {kind:'unknown'}}
  }
  function current(plan:FrozenMvuOpeningInitializationV2, receipt:MvuNativeOpeningReceipt, owned:MvuInitializationEvent):boolean {
    try {
      const proof = plan.freshNativeBasisProof
      const owner = root(plan.identity.sessionId)
      if (!owner || !same(proof.branch,{metaKey:owner.metaKey,metaSha256:owner.metaSha256,inheritance:'root',
        parentSessionId:null,inheritedPrefixLength:0,ready:true}) || !deps.nativeCurrent(receipt)
        || !same(proof.numerical,{headKey:mvuInitializationHeadKey(plan.identity.sessionId),headExists:false,
          eventMembershipSha256:recordSha256([]),eventCount:0,opaqueStateExists:false})
        || proof.native.committedOpeningCount !== 0 || proof.native.inheritedMessageCount !== 0) return false
      const events = eventsOf(owner.session)
      const cut = proof.native.observedThroughSeq
      if (!Number.isSafeInteger(cut) || cut < -1 || events.some((event,index) => event.seq !== index)
        || receipt.turnStartSeq !== cut + 1 || events.at(-1)?.seq !== receipt.turnEndSeq
        || recordSha256(events.filter(event => event.seq <= cut)) !== proof.native.historyVersionSha256
        || events.filter(opening).length !== 1) return false
      // The native adapter proves exact marker/message/closing ownership. Here
      // we also reject unrelated execution between the old basis and its receipt.
      const appended = events.filter(event => event.seq > cut)
      const permitted = ['turn/start','step/start','system/message','assistant/message','step/end','turn/end']
      if (appended.some(event => !permitted.includes(event.type) || event.data?.turn !== receipt.turn)
        || appended.filter(event => event.type === 'step/start').length !== 1
        || appended.filter(event => event.type === 'step/end').length !== 1
        || appended.some(event => event.type !== 'turn/start' && event.type !== 'turn/end' && event.data?.step !== 1)) return false
      const eventKey = mvuInitializationEventKey(plan.identity.sessionId,owned.eventId)
      const expectedHead:MvuInitializationHead = {schemaVersion:1,encoding:'mvu-programmatic-opening-head-v1',
        sessionId:plan.identity.sessionId,eventId:owned.eventId,revision:1,eventSha256:owned.eventSha256,
        planSha256:owned.plan.planSha256,valuesSha256:owned.valuesSha256}
      const headKey = mvuInitializationHeadKey(plan.identity.sessionId)
      // Only the precise owned writes may be present after a lost acknowledgement.
      // A foreign row, opaque value or successor head is never reset to revision 1.
      return rows(plan.identity.sessionId).every(([key,value]) => key === eventKey && same(value,owned)
        || key === headKey && same(value,expectedHead))
    } catch {return false}
  }
  return {fresh,current}
}
