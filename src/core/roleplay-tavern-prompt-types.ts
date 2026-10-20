import type {AuthorContributionPartV1} from './roleplay-author-contributions.js'
import type {TavernNativeFinalLoreTextV1} from './roleplay-tavern-layout.js'
import type {TavernLoreEntryPlanV1} from './tavern-lore-plan-types.mjs'

/** Process-local outputs of the actual request preparation. Persisted prompt
 * records never recreate this read; the input binder owns its exact lifetime. */
export interface TavernRenderedAuthorMaterialV1 {
  readonly sourceCurrentIdentitySha256:string
  readonly authorGroups:readonly {
    readonly id:'/native/current-author/cards'|'/native/current-author/rules'|'/native/current-author/examples'
    readonly text:string
    /** Complete captured group membership, including program/status parts. */
    readonly parts:readonly AuthorContributionPartV1[]
  }[]
  readonly finalLore:readonly TavernNativeFinalLoreTextV1[]
  readonly compilationEntries:readonly Pick<TavernLoreEntryPlanV1,
    'entryId'|'ordinal'|'sourceKey'|'sourcePointer'>[]
  /** The current DATA owner writes native members to book.entries in exactly
   * this order; otherwise the original book's sourceKey addresses the entry. */
  readonly currentNativeMembership:boolean
}
