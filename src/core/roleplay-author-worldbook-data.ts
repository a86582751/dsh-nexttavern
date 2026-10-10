/** Named primary-book DATA and deterministic mutation planning. The actual
 * Core lifecycle and lore journal remain the only read/write authorities. */
import {recordSha256} from './roleplay-data.js'
import {composeRoleplayTavernCurrentOverlayV1} from './roleplay-tavern-current-overlay.js'
import {originalTavernLoreMembershipFromSourceV1,applyTavernLoreMemberFieldsV1}
  from './roleplay-tavern-lore-membership.js'
import {nativeNamedWorldbookEntryToWireV1,worldbookWireToNativeEntryV1}
  from './tavern-named-worldbook-data.js'
import type {NativeNamedWorldbookEntryDataV1,WorldbookEntryWireV1,WorldbookEntryInputV1}
  from './tavern-named-worldbook-data.js'
import type {TavernLoreMemberV1,TavernLoreResolvedReplacementMemberV1} from './roleplay-tavern-lore-membership.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {TavernLoreEditsDataV1,TavernLoreMutationRequestV2} from './roleplay-tavern-lore-edits-types.js'
import type {TavernLoreCurrentNativeOverlayV1} from './tavern-lore-plan-types.mjs'

export interface AuthorNamedWorldbookDataV1 {
  readonly schemaVersion:1
  readonly encoding:'author-named-primary-worldbook-data-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly sourceSha256:string
  readonly loreDataSha256:string
  readonly revision:number
  readonly primaryName:string|null
  readonly names:readonly string[]
  /** Helper order is displayIndex order; the immutable archive keeps its keys. */
  readonly members:readonly TavernLoreMemberV1[]
  readonly entries:readonly WorldbookEntryWireV1[]
  readonly dataSha256:string
}
/** V2 carries the actual journal namespace as DATA for durable retry addressing. */
export interface AuthorNamedWorldbookDataV2 extends Omit<AuthorNamedWorldbookDataV1,'schemaVersion'|'encoding'> {
  readonly schemaVersion:2
  readonly encoding:'author-named-primary-worldbook-data-v2'
  readonly identitySha256:string
}
export type AuthorNamedWorldbookData=AuthorNamedWorldbookDataV1|AuthorNamedWorldbookDataV2
export type AuthorWorldbookMutationV1=
  |{kind:'create-entries';entries:readonly WorldbookEntryInputV1[]}
  |{kind:'delete-entries';uids:readonly number[]}
  |{kind:'replace-entries';entries:readonly (WorldbookEntryInputV1&{uid:number})[]}
  |{kind:'replace-worldbook';entries:readonly WorldbookEntryInputV1[]}
export interface AuthorWorldbookMutationPlanV1 {
  readonly request:TavernLoreMutationRequestV2
  readonly createdUids:readonly number[]
  readonly deletedEntries:readonly WorldbookEntryWireV1[]
}

/** The supplied journal and legacy differences came from the same Source
 * read. No model, global library or new Source identity is synthesized. */
function captureNamedWorldbookBody(source:TavernLoreSourceDataV1,data:TavernLoreEditsDataV1,
  legacy:TavernLoreCurrentNativeOverlayV1) {
  let membership=data.currentNativeMembership
  if(!membership) {
    membership=originalTavernLoreMembershipFromSourceV1(source)
    for(const entry of composeRoleplayTavernCurrentOverlayV1(legacy,data.overlay).entries) {
      membership=applyTavernLoreMemberFieldsV1(membership,{kind:'original',rawEntryPointer:entry.rawEntryPointer,
        rawEntrySha256:entry.rawEntrySha256},entry.fields)
    }
  }
  const name=source.original.primary.value?.name,
    primaryName=typeof name==='string'&&name.length?name:null,
    members=[...membership.members].sort((left,right)=>left.displayIndex-right.displayIndex)
  const entries=members.map(member=>nativeNamedWorldbookEntryToWireV1(
    member.rawEntry as NativeNamedWorldbookEntryDataV1,{uid:member.uid}))
  return {authority:'consumer-data-only' as const,sessionId:source.sessionId,sourceSha256:source.sourceSha256,
    loreDataSha256:data.dataSha256,revision:data.revision,primaryName,names:primaryName===null?[]:[primaryName],members,entries}
}

export function captureAuthorNamedWorldbookDataV1(source:TavernLoreSourceDataV1,data:TavernLoreEditsDataV1,
  legacy:TavernLoreCurrentNativeOverlayV1):AuthorNamedWorldbookDataV1 {
  const body={schemaVersion:1 as const,encoding:'author-named-primary-worldbook-data-v1' as const,
    ...captureNamedWorldbookBody(source,data,legacy)}
  return {...body,dataSha256:recordSha256(body)}
}
export function captureAuthorNamedWorldbookDataV2(source:TavernLoreSourceDataV1,data:TavernLoreEditsDataV1,
  legacy:TavernLoreCurrentNativeOverlayV1):AuthorNamedWorldbookDataV2 {
  const body={schemaVersion:2 as const,encoding:'author-named-primary-worldbook-data-v2' as const,
    identitySha256:data.identitySha256,...captureNamedWorldbookBody(source,data,legacy)}
  return {...body,dataSha256:recordSha256(body)}
}

/** The fixed Helper resolves collisions over the whole result, with quadratic
 * probing modulo one million. A default candidate here derives from the real
 * operation, so a lost reply never reallocates IDs when that operation retries.
 * Evidence: JS-Slash-Runner 519599bc... src/function/worldbook.ts 306–331. */
function allocateUid(desired:number|undefined,used:Set<number>,operationId:string,ordinal:number):number {
  let candidate=desired??Number.parseInt(recordSha256({operationId,ordinal}).slice(0,12),16)%1_000_000
  let probe=1
  while(used.has(candidate)) {candidate=(candidate+probe*probe)%1_000_000;probe++}
  used.add(candidate)
  return candidate
}

/** Predicates and updater callbacks run in the guest over its actual DTO
 * snapshot. Core receives resolved UID targets or entry DATA only. */
export function planAuthorWorldbookMutationV1(basis:AuthorNamedWorldbookData,name:string,operationId:string,
  mutation:AuthorWorldbookMutationV1):AuthorWorldbookMutationPlanV1 {
  if(name!==basis.primaryName)throw Error('AUTHOR_WORLDBOOK_NOT_FOUND')
  const current=new Map(basis.members.map(member=>[member.uid,member])),createdUids:number[]=[],
    deletedEntries:WorldbookEntryWireV1[]=[]
  let journalMutation:TavernLoreMutationRequestV2['mutation']
  if(mutation.kind==='delete-entries') {
    const removed=new Set(mutation.uids)
    basis.entries.forEach(entry=>{if(removed.has(entry.uid))deletedEntries.push(entry)})
    journalMutation={kind:'remove',targets:basis.members.filter(member=>removed.has(member.uid)).map(member=>member.identity)}
  }else if(mutation.kind==='create-entries') {
    const used=new Set(current.keys())
    // A sparse existing display order stays intact. New Helper entries append
    // after its actual last item rather than entering a gap left by deletion.
    const firstDisplayIndex=basis.members.reduce((maximum,member)=>Math.max(maximum,member.displayIndex),-1)+1
    const entries=mutation.entries.map((entry,ordinal)=>{
      const uid=allocateUid(entry.uid,used,operationId,ordinal),displayIndex=firstDisplayIndex+ordinal
      createdUids.push(uid)
      return {uid,displayIndex,rawEntry:worldbookWireToNativeEntryV1(entry,{uid,displayIndex})}
    })
    journalMutation={kind:'append',entries}
  }else if(mutation.kind==='replace-entries') {
    const replacements=new Map(mutation.entries.map(entry=>[entry.uid,entry]))
    for(const uid of replacements.keys())if(!current.has(uid))throw Error('AUTHOR_WORLDBOOK_ENTRY_NOT_FOUND')
    const entries=basis.members.map((member,displayIndex)=>{
      const entry=replacements.get(member.uid)
      return {...member,displayIndex,rawEntry:entry
        ?worldbookWireToNativeEntryV1(entry,{uid:member.uid,displayIndex},member.rawEntry):member.rawEntry}
    })
    journalMutation={kind:'replace',entries}
  }else {
    const used=new Set<number>()
    const entries:TavernLoreResolvedReplacementMemberV1[]=mutation.entries.map((entry,displayIndex)=>{
      const uid=allocateUid(entry.uid,used,operationId,displayIndex),previous=current.get(uid)
      if(!previous)createdUids.push(uid)
      return {uid,displayIndex,...previous?{identity:previous.identity}:{},
        rawEntry:worldbookWireToNativeEntryV1(entry,{uid,displayIndex},previous?.rawEntry)}
    })
    journalMutation={kind:'replace',entries}
  }
  const request:TavernLoreMutationRequestV2={schemaVersion:2,encoding:'tavern-lore-mutation-request-v2',
    sessionId:basis.sessionId,expectedSourceSha256:basis.sourceSha256,expectedRevision:basis.revision,operationId,
    mutation:journalMutation}
  return {request,createdUids,deletedEntries}
}

export function authorWorldbookMutationReplyV1(plan:AuthorWorldbookMutationPlanV1,actual:AuthorNamedWorldbookData) {
  const created=new Set(plan.createdUids)
  return {worldbook:actual.entries,new_entries:actual.entries.filter(entry=>created.has(entry.uid)),
    deleted_entries:plan.deletedEntries}
}
