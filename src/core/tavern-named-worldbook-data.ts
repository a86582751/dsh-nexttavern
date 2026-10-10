/** Fixed ST/Helper field conversion only. Callers own Source admission, UID
 * allocation, ordering and persistence; this DATA never supplies those owners. */
import type {MvuJsonObject,MvuJsonValue} from './tavern-mvu-initvar.js'

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

const positions:readonly NamedWorldbookPositionV1[]=['before_character_definition','after_character_definition',
  'before_author_note','after_author_note','at_depth','before_example_messages','after_example_messages','outlet']
const roles=['system','user','assistant'] as const
const secondaryLogic:readonly NamedWorldbookSecondaryLogicV1[]=['and_any','not_all','not_any','and_all']
const controlsKey='nexttavern_worldbook_entry'
const controlsEncoding='nexttavern-worldbook-entry-controls-v1'
const isObject=(value:MvuJsonValue|undefined):value is MvuJsonObject=>
  value!==null&&typeof value==='object'&&!Array.isArray(value)
const copy=<T>(value:T):T=>structuredClone(value)
const positive=(value:MvuJsonValue|undefined):number|null=>typeof value==='number'&&value>0?value:null
const extensionsOf=(raw:MvuJsonObject):MvuJsonObject=>isObject(raw.extensions)?raw.extensions:{}

/** Match the fixed ST slash parser, including its literal fallback for invalid
 * regex syntax/flags. Canonical strings represent the RegExp returned by Helper. */
function wireKey(key:string):string {
  const match=key.match(/^\/([\w\W]+?)\/([gimsuy]*)$/)
  if(!match||/(^|[^\\])\//.test(match[1]!))return key
  try {return new RegExp(match[1]!.replace('\\/','/'),match[2]).toString()}
  catch {return key}
}

/** Ordering fallback is supplied from the actual collection by its owner.
 * It is independent of both an entry's UID and its insertion order. */
export function namedWorldbookDisplayIndexV1(raw:MvuJsonObject,fallbackDisplayIndex?:number):number {
  const displayIndex=extensionsOf(raw).display_index??fallbackDisplayIndex
  if(typeof displayIndex!=='number')throw Error('NAMED_WORLDBOOK_DISPLAY_INDEX_REQUIRED')
  return displayIndex
}

/** The membership owner supplies Helper's numeric UID projection. Without that
 * projection, a stock numeric id can still be consumed directly. */
export function nativeNamedWorldbookEntryToWireV1(raw:NativeNamedWorldbookEntryDataV1,
  options:{uid?:number}={}):WorldbookEntryWireV1 {
  const uid=options.uid??raw.id
  if(typeof uid!=='number')throw Error('NAMED_WORLDBOOK_UID_REQUIRED')
  const extensions=extensionsOf(raw),comment=(raw.comment||'') as string
  const position=(extensions.position??(raw.position==='before_char'?0:1)) as 0|1|2|3|4|5|6|7
  const role=(extensions.role??0) as 0|1|2
  const logic=(extensions.selectiveLogic??0) as 0|1|2|3
  const entry:WorldbookEntryWireV1={
    uid,name:comment,enabled:!!raw.enabled,
    strategy:{type:raw.constant?'constant':extensions.vectorized?'vectorized':'selective',
      keys:raw.keys.map(wireKey),
      keys_secondary:{logic:secondaryLogic[logic]!,keys:((raw.secondary_keys??[]) as string[]).map(wireKey)},
      scan_depth:(extensions.scan_depth??'same_as_global') as number|'same_as_global'},
    position:{type:positions[position]!,role:roles[role],depth:(extensions.depth??4) as number,
      order:raw.insertion_order},
    content:raw.content,
    probability:extensions.useProbability===false?100:(extensions.probability??100) as number,
    recursion:{prevent_incoming:(extensions.exclude_recursion??false) as boolean,
      prevent_outgoing:(extensions.prevent_recursion??false) as boolean,
      delay_until:positive(extensions.delay_until_recursion)},
    effect:{sticky:positive(extensions.sticky),cooldown:positive(extensions.cooldown),delay:positive(extensions.delay)},
    addMemo:!!comment,
    matchPersonaDescription:(extensions.match_persona_description??false) as boolean,
    matchCharacterDescription:(extensions.match_character_description??false) as boolean,
    matchCharacterPersonality:(extensions.match_character_personality??false) as boolean,
    matchCharacterDepthPrompt:(extensions.match_character_depth_prompt??false) as boolean,
    matchScenario:(extensions.match_scenario??false) as boolean,
    matchCreatorNotes:(extensions.match_creator_notes??false) as boolean,
    group:(extensions.group??'') as string,groupOverride:(extensions.group_override??false) as boolean,
    groupWeight:(extensions.group_weight??100) as number,caseSensitive:(extensions.case_sensitive??null) as boolean|null,
    matchWholeWords:(extensions.match_whole_words??null) as boolean|null,
    useGroupScoring:(extensions.use_group_scoring??null) as boolean|null,
    automationId:(extensions.automation_id??'') as string,ignoreBudget:(extensions.ignore_budget??false) as boolean,
    outletName:(extensions.outlet_name??'') as string,triggers:copy((extensions.triggers??[]) as string[]),
    characterFilter:{isExclude:false,names:[],tags:[]},
    ...(isObject(raw.extra)?{extra:copy(raw.extra)}:{})}
  const controls=extensions[controlsKey]
  if(controls!==undefined) {
    if(!isObject(controls)||controls.schemaVersion!==1||controls.encoding!==controlsEncoding) {
      throw Error('NAMED_WORLDBOOK_CONTROLS_VERSION_UNSUPPORTED')
    }
    const explicit=controls as unknown as NextTavernWorldbookEntryControlsV1
    entry.addMemo=explicit.addMemo
    entry.characterFilter=copy(explicit.characterFilter)
    // The extension is a complete explicit override: omitted extra resets its
    // current value while preserved raw.extra remains original author metadata.
    delete entry.extra
    if(explicit.extra)entry.extra=copy(explicit.extra)
  }
  return entry
}

/** Helper replacement semantics: omitted known fields reset to its creation
 * defaults. The supplied base preserves unknown DATA, not prior current fields.
 * The owner has already resolved collisions and the final display ordinal. */
export function worldbookWireToNativeEntryV1(input:WorldbookEntryInputV1,
  identity:NamedWorldbookEntryIdentityV1,unknownBase:MvuJsonObject={}):NativeNamedWorldbookEntryDataV1 {
  const raw=copy(unknownBase),extensions=copy(extensionsOf(unknownBase))
  const position=positions.indexOf(input.position?.type??'at_depth')
  // Existing native ids are metadata of the retained incarnation. A Helper
  // numeric projection never rewrites a textual id in its Native export.
  if(!Object.hasOwn(raw,'id'))raw.id=identity.uid
  raw.keys=copy(input.strategy?.keys??[])
  raw.secondary_keys=copy(input.strategy?.keys_secondary?.keys??[])
  raw.comment=input.name??''
  raw.content=input.content??''
  raw.constant=input.strategy?.type?input.strategy.type==='constant':true
  raw.selective=input.strategy?.type==='selective'
  raw.insertion_order=input.position?.order??100
  raw.enabled=input.enabled??true
  raw.position=position===0?'before_char':'after_char'
  raw.use_regex=true
  Object.assign(extensions,{
    position,display_index:identity.displayIndex,
    exclude_recursion:input.recursion?.prevent_incoming??false,
    prevent_recursion:input.recursion?.prevent_outgoing??false,
    delay_until_recursion:input.recursion?.delay_until??false,
    probability:input.probability??100,useProbability:true,
    depth:input.position?.depth??4,role:roles.indexOf(input.position?.role??'system'),
    selectiveLogic:secondaryLogic.indexOf(input.strategy?.keys_secondary?.logic??'and_any'),
    scan_depth:input.strategy?.scan_depth==='same_as_global'?null:input.strategy?.scan_depth??null,
    vectorized:input.strategy?.type==='vectorized',
    sticky:input.effect?.sticky??null,cooldown:input.effect?.cooldown??null,delay:input.effect?.delay??null,
    match_persona_description:input.matchPersonaDescription??false,
    match_character_description:input.matchCharacterDescription??false,
    match_character_personality:input.matchCharacterPersonality??false,
    match_character_depth_prompt:input.matchCharacterDepthPrompt??false,
    match_scenario:input.matchScenario??false,match_creator_notes:input.matchCreatorNotes??false,
    group:input.group??'',group_override:input.groupOverride??false,group_weight:input.groupWeight??100,
    case_sensitive:input.caseSensitive??null,match_whole_words:input.matchWholeWords??null,
    use_group_scoring:input.useGroupScoring??null,automation_id:input.automationId??'',
    ignore_budget:input.ignoreBudget??false,outlet_name:input.outletName??'',triggers:copy(input.triggers??[])})
  const originalControls=extensions[controlsKey]
  const controls:MvuJsonObject={...(isObject(originalControls)?originalControls:{}),schemaVersion:1,
    encoding:controlsEncoding,addMemo:input.addMemo??true,
    characterFilter:{isExclude:input.characterFilter?.isExclude??false,
      names:copy(input.characterFilter?.names??[]),tags:copy(input.characterFilter?.tags??[])}}
  delete controls.extra
  if(input.extra)controls.extra=copy(input.extra)
  extensions[controlsKey]=controls
  raw.extensions=extensions
  return raw as NativeNamedWorldbookEntryDataV1
}
