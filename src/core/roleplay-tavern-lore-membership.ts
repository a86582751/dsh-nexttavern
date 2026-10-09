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
