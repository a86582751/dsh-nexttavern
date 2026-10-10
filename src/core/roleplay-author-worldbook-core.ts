/** The Core DATA reader and existing lore writer own named primary books.
 * Guest callbacks resolve DTO targets; they never select storage or sessions. */
import {captureAuthorNamedWorldbookDataV2,planAuthorWorldbookMutationV1,authorWorldbookMutationReplyV1}
  from './roleplay-author-worldbook-data.js'
import type {AuthorNamedWorldbookData,AuthorNamedWorldbookDataV2} from './roleplay-author-worldbook-data.js'
import type {createRoleplayTavernLoreSourceV1} from './roleplay-tavern-lore-source.js'
import type {createRoleplayTavernLoreEditsV1} from './roleplay-tavern-lore-edits.js'
import type {RoleplayInputStateRead} from './roleplay-input-state.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernLoreCurrentNativeOverlayV1} from './tavern-lore-plan-types.mjs'
import type {BrowserWorldbookMutationRequestV2,BrowserWorldbookMutationReplyV2}
  from './tavern-author-browser-types-v2.mjs'

import type {TavernLoreMutationRetryLocatorV1} from './roleplay-tavern-lore-edits-types.js'

interface Dependencies {
  readonly source:ReturnType<typeof createRoleplayTavernLoreSourceV1>
  readonly edits:ReturnType<typeof createRoleplayTavernLoreEditsV1>
  captureRead<T>(sid:string,compute:()=>T):RoleplayInputStateRead<T>
  withSourceLock<T>(sid:string,work:()=>T|PromiseLike<T>):Promise<T>
}
export function createRoleplayAuthorWorldbookCoreV1(deps:Dependencies) {
  // Keep the actual Source bytes behind this factory's DATA object. Journal
  // currency still owns admission; this association grants no execution right.
  const capturedBases=new WeakMap<AuthorNamedWorldbookData,{source:TavernLoreSourceDataV1;
    editorBaseOverlay:TavernLoreCurrentNativeOverlayV1}>()
  function capture(sid:string):Promise<RoleplayInputStateRead<AuthorNamedWorldbookDataV2>> {
    return deps.withSourceLock(sid,()=>deps.captureRead(sid,()=>{
      const source=deps.source.capture(sid)
      if(source.kind!=='captured-data')throw Error('AUTHOR_WORLDBOOK_SOURCE_UNAVAILABLE')
      const {observed,legacy}=deps.edits.observeJournalDataWithLegacyData(source)
      if(observed.kind!=='captured-data'||!legacy)throw Error('AUTHOR_WORLDBOOK_JOURNAL_UNAVAILABLE')
      const basis=captureAuthorNamedWorldbookDataV2(source.source,observed.data,legacy.overlay)
      capturedBases.set(basis,{source:source.source,editorBaseOverlay:legacy.overlay})
      return basis
    }))
  }
  async function mutate(sid:string,request:BrowserWorldbookMutationRequestV2,basis:AuthorNamedWorldbookData,
    originalOwnerCurrent:()=>boolean,signal:AbortSignal):Promise<Omit<BrowserWorldbookMutationReplyV2,'snapshot'>> {
    signal.throwIfAborted()
    if(!originalOwnerCurrent())throw Error('BROWSER_ATTACHMENT_REVOKED')
    const captured=capturedBases.get(basis)
    if(!captured||basis.sessionId!==sid||request.expectedDataSha256!==basis.dataSha256)
      throw Error('AUTHOR_WORLDBOOK_STALE_BASE')
    const plan=planAuthorWorldbookMutationV1(basis,request.name,request.operationId,request.mutation)
    // Preserve the request's captured Source bytes across ordinary Story counter
    // changes. The journal checks live Source/head under its existing FIFO; the
    // immutable Native owner must survive the lock and durable write waits.
    const result=await deps.edits.mutate(plan.request,()=>!signal.aborted&&originalOwnerCurrent(),captured)
    if(result.kind!=='edited-data')return {result}
    // A V2 publication already contains legacy fields in current membership;
    // capture consumes that result directly without applying overlay twice.
    const actual=captureAuthorNamedWorldbookDataV2(result.data.source,result.data,result.data.overlay)
    const {schemaVersion,kind,receipt}=result
    return {result:{schemaVersion,kind,receipt},...authorWorldbookMutationReplyV1(plan,actual)}
  }
  async function retry(sid:string,operationId:string,current:()=>boolean,signal:AbortSignal,
    locator?:TavernLoreMutationRetryLocatorV1):
    Promise<BrowserWorldbookMutationReplyV2['result']> {
    signal.throwIfAborted()
    const result=await (locator
      ?deps.edits.retryMutation(sid,operationId,()=>!signal.aborted&&current(),locator)
      :deps.edits.retryMutation(sid,operationId,()=>!signal.aborted&&current()))
    if(result.kind==='refused')return result
    const {schemaVersion,kind,receipt}=result
    return {schemaVersion,kind,receipt}
  }
  return {capture,mutate,retry}
}
