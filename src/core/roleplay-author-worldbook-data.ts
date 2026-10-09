import type {WorldbookEntryWireV1,WorldbookEntryInputV1} from './tavern-named-worldbook-data.js'

import type {TavernLoreMemberV1} from './roleplay-tavern-lore-membership.js'

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
