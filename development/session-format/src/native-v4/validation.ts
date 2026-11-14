// Adapted from DeepSeek MIT source 477b4f420553e8a52c2fbccc464d7561b239c443:
// packages/session/session-format-v3-to-v4/src/validation.ts; see PROVENANCE.md and LICENSE.
import {SessionFormatError,isSessionFormatJsonObject,sessionFormatCount} from '@deepseek-ai/dsh-session-format'
import type {SessionFormatArtifact,SessionFormatEvent} from '@deepseek-ai/dsh-session-format'
import {assertV4DeveloperData} from './developer.js'
import {assertV4MessageSources} from './message-sources.js'
import {catalogFact} from './facts.js'
import {Relationships} from './relationships.js'

export function validateDeliveryAccepted(event: SessionFormatEvent, currentVersion: 3 | 4): string | undefined {
  if (event.type !== 'session-log-deepseek/delivery-accepted') return undefined
  const data = event.data
  if (!isSessionFormatJsonObject(data)) throw new SessionFormatError('delivery-accepted data must be an object')
  const version = sessionFormatCount(data['sessionFormatVersion'] === undefined ? 0 : data['sessionFormatVersion'], 'delivery sessionFormatVersion')
  if (version !== currentVersion) return undefined
  const throughSeq = sessionFormatCount(data['throughSeq'], 'delivery throughSeq')
  if (throughSeq >= event.seq) throw new SessionFormatError('delivery throughSeq must precede its marker')
  const id = data['sessionId']
  if (typeof id !== 'string' || id.length === 0) throw new SessionFormatError('delivery requires a nonempty Session id')
  return id
}

export interface NativeV4RelationshipInput {
  readonly length:number
  at(seq:number):SessionFormatEvent|undefined
}

/** One accepted physical event owner calls this at read boundaries. Writes
 * only extend its immutable input: they do not eagerly reject a prefix that
 * a later end-seed can legitimately close under the released lookahead rule. */
export function createNativeV4RelationshipValidator(header:Pick<SessionFormatArtifact['header'],'id'|'parentSession'>,inheritedEventCount:number,
  knownEventTypes:ReadonlySet<string>) {
  let current:NativeV4RelationshipInput|undefined,verifiedThrough=0,openCompactionStart:number|undefined
  const ids=new Set<string>(),state=new Relationships({header,inheritedEventCount,at:seq=>current?.at(seq)},knownEventTypes)
  return {
    get verifiedThrough(){return verifiedThrough},
    verify(input:NativeV4RelationshipInput):void {
      if(input.length<verifiedThrough)throw new SessionFormatError('native V4 relationship owner cannot rewind its accepted prefix')
      if(input.length===verifiedThrough)return
      const prior=current,addedCatalog:string[]=[],addedOrphans:number[]=[],transaction=state.begin()
      current=input
      try {
        // Match the released whole-validator order: all producer/delivery/
        // catalog facts precede the orphan lookahead and lifecycle pass.
        for(let seq=verifiedThrough;seq<input.length;seq++) {
          const event=input.at(seq)!
          if(!knownEventTypes.has(event.type))continue
          assertV4DeveloperData(event);assertV4MessageSources(event)
          const deliveryId=validateDeliveryAccepted(event,4)
          if(deliveryId!==undefined&&!(header.parentSession!==undefined&&event.seq<inheritedEventCount)
            &&deliveryId!==header.id)throw new SessionFormatError('current-generation delivery marker names the wrong Session')
          if(event.type==='subagent/catalog'&&event.seq>=inheritedEventCount) {
            const id=catalogFact(event.data)['childId'] as string
            if(ids.has(id))throw new SessionFormatError(`duplicate catalog child ${id}`)
            ids.add(id);addedCatalog.push(id)
          }
        }
        let start=openCompactionStart
        for(let seq=verifiedThrough;seq<input.length;seq++) {
          const event=input.at(seq)!
          if(!knownEventTypes.has(event.type))continue
          if(event.type==='compaction/start')start=event.seq
          if(event.type==='compaction/end')start=undefined
          if(event.type==='session/end-seed') {
            if(start!==undefined&&!state.orphanCompactions.has(start)) {
              state.orphanCompactions.add(start);addedOrphans.push(start)
            }
            start=undefined
          }
        }
        for(let seq=verifiedThrough;seq<input.length;seq++)state.accept(input.at(seq)!)
        transaction.commit();openCompactionStart=start;verifiedThrough=input.length
      }catch(error) {
        transaction.rollback()
        for(const id of addedCatalog)ids.delete(id)
        for(const seq of addedOrphans)state.orphanCompactions.delete(seq)
        current=prior
        throw error
      }
    },
  }
}

/** Cold reads instantiate the same authority used by a retained hot owner. */
export function assertNativeV4Relationships(artifact:SessionFormatArtifact,knownEventTypes:ReadonlySet<string>):void {
  const validator=createNativeV4RelationshipValidator(artifact.header,artifact.inheritedEventCount,knownEventTypes)
  validator.verify({length:artifact.events.length,at:seq=>artifact.events[seq]})
}

