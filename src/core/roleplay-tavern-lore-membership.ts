import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {TavernLoreEditRefV1} from './roleplay-tavern-lore-edits-types.js'


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
