import type {MvuJsonObject} from './tavern-mvu-initvar.js'

export type NamedWorldbookPositionV1='before_character_definition'|'after_character_definition'
  |'before_example_messages'|'after_example_messages'|'before_author_note'|'after_author_note'|'at_depth'|'outlet'

export type NamedWorldbookSecondaryLogicV1='and_any'|'not_all'|'not_any'|'and_all'

export type NamedWorldbookCharacterFilterV1={isExclude:boolean;names:string[];tags:string[]}

/** Regex keys cross the guest DATA channel as slash strings, never RegExp objects. */
export type WorldbookEntryWireV1={
  uid:number
  name:string
  enabled:boolean
  strategy:{type:'constant'|'selective'|'vectorized';keys:string[];
    keys_secondary:{logic:NamedWorldbookSecondaryLogicV1;keys:string[]};scan_depth:'same_as_global'|number}
  position:{type:NamedWorldbookPositionV1;role:'system'|'user'|'assistant';depth:number;order:number}
  content:string
  probability:number
  recursion:{prevent_incoming:boolean;prevent_outgoing:boolean;delay_until:number|null}
  effect:{sticky:number|null;cooldown:number|null;delay:number|null}
  addMemo:boolean
  matchPersonaDescription:boolean
  matchCharacterDescription:boolean
  matchCharacterPersonality:boolean
  matchCharacterDepthPrompt:boolean
  matchScenario:boolean
  matchCreatorNotes:boolean
  group:string
  groupOverride:boolean
  groupWeight:number
  caseSensitive:boolean|null
  matchWholeWords:boolean|null
  useGroupScoring:boolean|null
  automationId:string
  ignoreBudget:boolean
  outletName:string
  triggers:string[]
  characterFilter:NamedWorldbookCharacterFilterV1
  extra?:MvuJsonObject
}

export type WorldbookEntryInputV1=Partial<Omit<WorldbookEntryWireV1,
  'strategy'|'position'|'recursion'|'effect'|'characterFilter'>> & {
  strategy?:Partial<Omit<WorldbookEntryWireV1['strategy'],'keys_secondary'>> & {
    keys_secondary?:Partial<WorldbookEntryWireV1['strategy']['keys_secondary']>}
  position?:Partial<WorldbookEntryWireV1['position']>
  recursion?:Partial<WorldbookEntryWireV1['recursion']>
  effect?:Partial<WorldbookEntryWireV1['effect']>
  characterFilter?:Partial<NamedWorldbookCharacterFilterV1>
}

export type NextTavernWorldbookEntryControlsV1={
  schemaVersion:1
  encoding:'nexttavern-worldbook-entry-controls-v1'
  addMemo:boolean
  characterFilter:NamedWorldbookCharacterFilterV1
  extra?:MvuJsonObject
}

export interface NamedWorldbookEntryIdentityV1 {uid:number;displayIndex:number}

/** The stock importer supplies these fields directly without creation defaults.
 * An owner handles retained/ineligible raw DATA before requesting a full DTO. */
export type NativeNamedWorldbookEntryDataV1=MvuJsonObject & {
  keys:string[];content:string;insertion_order:number
}
