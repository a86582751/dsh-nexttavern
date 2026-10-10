/** Pure fold for the existing lore journal's published membership mutations.
 * The journal owns admission, publication and recovery; this DATA creates no
 * second head and never follows a parent's current entries after a fork. */
import {recordSha256} from './roleplay-data.js'
import {materializeTavernLoreEntryFieldsV1,validateTavernLoreCurrentNativeFieldsV1} from './tavern-lore-compiler.mjs'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {TavernLoreEditRefV1,TavernLoreJournalRequestV2} from './roleplay-tavern-lore-edits-types.js'
import type {TavernLoreCurrentNativeFieldsV1,TavernLoreCurrentNativeOverlayV1} from './tavern-lore-plan-types.mjs'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'

export type TavernLoreMemberIdentityV1={
  kind:'original';rawEntryPointer:string;rawEntrySha256:string
}|{kind:'introduced';eventRef:TavernLoreEditRefV1;ordinal:number}

export interface TavernLoreMemberV1 {
  identity:TavernLoreMemberIdentityV1
  /** The importer or mutation planner resolves UID and order once. A UID is
   * reusable; it is never the identity of an entry incarnation. */
  uid:number
  displayIndex:number
  rawEntry:MvuJsonObject
}
export interface TavernLoreTombstoneV1 {
  identity:TavernLoreMemberIdentityV1
  eventRef:TavernLoreEditRefV1
}
export interface TavernLoreMembershipDataV1 {
  schemaVersion:1
  encoding:'tavern-lore-membership-data-v1'
  members:readonly TavernLoreMemberV1[]
  tombstones:readonly TavernLoreTombstoneV1[]
}
export interface TavernLoreResolvedNewMemberV1 {
  uid:number
  displayIndex:number
  rawEntry:MvuJsonObject
}
export type TavernLoreResolvedReplacementMemberV1=TavernLoreResolvedNewMemberV1 & {
  /** Absence creates a new incarnation in this event, even if its UID existed
   * in a previous, already removed entry. */
  identity?:TavernLoreMemberIdentityV1
}
export type TavernLoreMembershipMutationV1=
  |{kind:'append';entries:readonly TavernLoreResolvedNewMemberV1[]}
  |{kind:'remove';targets:readonly TavernLoreMemberIdentityV1[]}
  |{kind:'replace';entries:readonly TavernLoreResolvedReplacementMemberV1[]}

export const tavernLoreMemberIdentitySha256V1=(identity:TavernLoreMemberIdentityV1)=>recordSha256(identity)

/** Source has already admitted the original pointers, raw DATA and importer
 * identities. Their captured order is retained until an explicit mutation. */
export function originalTavernLoreMembershipV1(members:readonly TavernLoreMemberV1[]):TavernLoreMembershipDataV1 {
  return {schemaVersion:1,encoding:'tavern-lore-membership-data-v1',members:[...members],tombstones:[]}
}
export function originalTavernLoreMembershipFromSourceV1(source:TavernLoreSourceDataV1):TavernLoreMembershipDataV1 {
  // Helper's DTO uses numeric UIDs while Source may retain textual native ids.
  // Reserve every explicit numeric value before assigning ordinal fallbacks so
  // reading another original entry cannot later rename a fallback member.
  const explicit=source.original.primary.entries.map(entry=>{
    const id=(entry.value as MvuJsonObject).id
    const numeric=typeof id==='number'?id:typeof id==='string'&&id.trim()?Number(id):undefined
    return Number.isSafeInteger(numeric)?numeric as number:undefined
  })
  const used=new Set(explicit.filter((uid):uid is number=>uid!==undefined))
  return originalTavernLoreMembershipV1(source.original.primary.entries.map((entry,ordinal)=>{
    const raw=entry.value as MvuJsonObject,extensions=raw.extensions
    let uid=explicit[ordinal]
    if(uid===undefined) {
      uid=ordinal
      while(used.has(uid))uid++
      used.add(uid)
    }
    return {identity:{kind:'original',rawEntryPointer:entry.ref.entryPointer,rawEntrySha256:entry.ref.entrySha256},
      uid,
      displayIndex:(extensions&&typeof extensions==='object'&&!Array.isArray(extensions)
        ?extensions.display_index??ordinal:ordinal) as number,rawEntry:raw}
  }))
}

/** Only actual published events enter this fold. The caller supplies the real
 * immutable event reference; planning never embeds a self-referential hash. */
export function applyTavernLoreMembershipMutationV1(data:TavernLoreMembershipDataV1,
  mutation:TavernLoreMembershipMutationV1,eventRef:TavernLoreEditRefV1):TavernLoreMembershipDataV1 {
  const members=new Map(data.members.map(member=>[tavernLoreMemberIdentitySha256V1(member.identity),member]))
  const tombstones=[...data.tombstones]
  const introduce=(entry:TavernLoreResolvedNewMemberV1,ordinal:number):TavernLoreMemberV1=>({
    ...entry,identity:{kind:'introduced',eventRef,ordinal}})
  const remove=(identity:TavernLoreMemberIdentityV1)=>{
    const key=tavernLoreMemberIdentitySha256V1(identity),member=members.get(key)
    if(!member)throw Error('TAVERN_LORE_MEMBER_TARGET_MISSING')
    members.delete(key)
    tombstones.push({identity:member.identity,eventRef})
  }
  if(mutation.kind==='append') {
    for(const [ordinal,entry] of mutation.entries.entries()) {
      const member=introduce(entry,ordinal)
      members.set(tavernLoreMemberIdentitySha256V1(member.identity),member)
    }
  }else if(mutation.kind==='remove') {
    for(const identity of mutation.targets)remove(identity)
  }else {
    const replacement=mutation.entries.map((entry,ordinal)=>{
      if(!entry.identity)return introduce(entry,ordinal)
      if(!members.has(tavernLoreMemberIdentitySha256V1(entry.identity)))throw Error('TAVERN_LORE_MEMBER_TARGET_MISSING')
      return {...entry,identity:entry.identity}
    })
    const retained=new Set(replacement.map(member=>tavernLoreMemberIdentitySha256V1(member.identity)))
    for(const member of data.members)if(!retained.has(tavernLoreMemberIdentitySha256V1(member.identity)))remove(member.identity)
    members.clear()
    for(const member of replacement)members.set(tavernLoreMemberIdentitySha256V1(member.identity),member)
  }
  return {...data,members:[...members.values()],tombstones}
}

/** V1 edits continue to identify their original entry. A later entry with the
 * same numeric UID cannot inherit or receive those historical field edits. */
export function applyTavernLoreMemberFieldsV1(data:TavernLoreMembershipDataV1,
  identity:TavernLoreMemberIdentityV1,fields:TavernLoreCurrentNativeFieldsV1):TavernLoreMembershipDataV1 {
  const key=tavernLoreMemberIdentitySha256V1(identity)
  let found=false
  const members=data.members.map(member=>{
    if(tavernLoreMemberIdentitySha256V1(member.identity)!==key)return member
    found=true
    return {...member,displayIndex:fields.displayIndex??member.displayIndex,
      rawEntry:materializeTavernLoreEntryFieldsV1(member.rawEntry,fields) as MvuJsonObject}
  })
  if(!found)throw Error('TAVERN_LORE_MEMBER_TARGET_MISSING')
  return {...data,members}
}

/** Fold the actual frozen ancestor layers and local publication sequence over
 * the unchanged original archive. No ancestor's mutable head is consulted. */
export function foldTavernLorePublishedMembershipV2(source:TavernLoreSourceDataV1,
  rows:readonly {eventRef:TavernLoreEditRefV1;request:TavernLoreJournalRequestV2}[],
  legacy?:TavernLoreCurrentNativeOverlayV1):TavernLoreMembershipDataV1|undefined {
  if(!rows.some(row=>'mutation' in row.request))return undefined
  let data=originalTavernLoreMembershipFromSourceV1(source)
  for(const entry of legacy?.entries??[])data=applyTavernLoreMemberFieldsV1(data,
    {kind:'original',rawEntryPointer:entry.rawEntryPointer,rawEntrySha256:entry.rawEntrySha256},entry.fields)
  for(const {request,eventRef} of rows) {
    if(!('mutation' in request)) {
      data=applyTavernLoreMemberFieldsV1(data,{kind:'original',rawEntryPointer:request.rawEntryPointer,
        rawEntrySha256:request.rawEntrySha256},request.fields)
      continue
    }
    const mutation=request.mutation
    if(mutation.kind==='fields') {
      validateTavernLoreCurrentNativeFieldsV1(mutation.fields)
      data=applyTavernLoreMemberFieldsV1(data,mutation.target,mutation.fields)
      continue
    }
    if(mutation.kind==='append'||mutation.kind==='replace') {
      const uids=new Set(mutation.kind==='append'?data.members.map(member=>member.uid):[]),identities=new Set<string>()
      for(const entry of mutation.entries) {
        if(uids.has(entry.uid))throw Error('TAVERN_LORE_MEMBER_UID_CONFLICT')
        uids.add(entry.uid)
        if('identity' in entry&&entry.identity) {
          const key=tavernLoreMemberIdentitySha256V1(entry.identity)
          if(identities.has(key))throw Error('TAVERN_LORE_MEMBER_IDENTITY_CONFLICT')
          identities.add(key)
        }
      }
    }
    data=applyTavernLoreMembershipMutationV1(data,mutation,eventRef)
  }
  return data
}
