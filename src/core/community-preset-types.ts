/** Imported community data is inert. Script sources remain in raw, never executable. */
export type CommunityJson = null | boolean | number | string | CommunityJson[] | {[key:string]:CommunityJson}
export type CommunityPresetProfileId = 'standard' | 'dream' | 'kemini' | 'reborn' | 'izumi'
export type CommunityPromptRole = 'system' | 'user' | 'assistant'
export type CommunityMarker = 'worldInfoBefore' | 'worldInfoAfter' | 'charDescription' | 'charPersonality'
  | 'scenario' | 'personaDescription' | 'dialogueExamples' | 'chatHistory'
export type CommunityIzumiLayer = 'structure' | 'function' | 'style'
export type CommunityIzumiSection = 'plain' | 'tail' | 'armor' | 'tucao' | 'thinking' | 'extra'
export interface CommunityPresetPrompt {
  identifier:string
  name:string
  content:string
  role:CommunityPromptRole
  enabled:boolean
  marker:CommunityMarker | null
  injectionPosition:number
  injectionDepth:number
  injectionOrder:number
  readOnly:boolean
  hidden:boolean
  configurationOnly:boolean
  unused:boolean
  sectionBoundary?:boolean
  layer?:CommunityIzumiLayer
  section?:CommunityIzumiSection
  raw:Record<string,CommunityJson>
}
export interface CommunityPresetOrder {identifier:string;enabled:boolean}
export interface CommunityRegexRule {
  id:string
  scriptName:string
  findRegex:string
  replaceString:string
  trimStrings:string[]
  placement:number[]
  disabled:boolean
  markdownOnly:boolean
  promptOnly:boolean
  runOnEdit:boolean
  substituteRegex:number
  minDepth:number|null
  maxDepth:number|null
  raw:Record<string,CommunityJson>
}
export interface CommunityPresetControlOption {
  id:string
  label:string
  type:string
  enable:string[]
  disable:string[]
  variableId?:string
  match?:{below:string;above:string}
  raw:Record<string,CommunityJson>
}
export interface CommunityPresetControlGroup {
  id:string
  label:string
  mode:'single'|'multiple'
  options:CommunityPresetControlOption[]
  enableGroup:string[]
  disableGroup:string[]
  raw:Record<string,CommunityJson>
}
export interface CommunityPresetProfile {
  id:CommunityPresetProfileId
  version:1
  groups:CommunityPresetControlGroup[]
  /** Pure script data/configuration; no source code is interpreted at generation time. */
  configuration:Record<string,CommunityJson>
  transport:Record<string,CommunityJson>
  actions:{id:string;status:'deferred';reason:string}[]
}
export interface CommunityPresetSource {
  fileName:string
  sha256:string
  version:CommunityJson
  rawText:string
  raw:Record<string,CommunityJson>
}
export interface CommunityPresetV1 {
  schema:'community-presets.v1'
  version:1
  id:string
  name:string
  source:CommunityPresetSource
  prompts:CommunityPresetPrompt[]
  promptOrder:CommunityPresetOrder[]
  characterId:number|null
  regexes:CommunityRegexRule[]
  regexSource:'native'|'spreset'|'legacy'|'none'
  parameters:Record<string,CommunityJson>
  profile:CommunityPresetProfile
}
export interface CommunityPresetParseOptions {id:string;name:string;fileName?:string;rawText?:string}
export interface CommunityIzumiPlanEntry {
  id?:string
  name?:string
  sameNameIndex:number
  enabled:boolean
  raw:Record<string,CommunityJson>
}
export interface CommunityIzumiPlan {
  id:string
  name:string
  layer:CommunityIzumiLayer
  section:string
  strict:boolean
  entries:CommunityIzumiPlanEntry[]
  raw:Record<string,CommunityJson>
}
export interface CommunityIzumiPlanPackV2 {
  schema:'izumi-layer-plan-pack'
  version:2
  plans:CommunityIzumiPlan[]
  /** Importing preserves selections without applying them. */
  active:Record<string,CommunityJson>
  quickSlots:CommunityJson[]
  raw:Record<string,CommunityJson>
}
export interface CommunityIzumiPlanResult {
  preset:CommunityPresetV1
  applied:string[]
  unresolved:CommunityIzumiPlanEntry[]
}
/** Reader's selected history page and its live projection cache share a window. */
export const COMMUNITY_READER_WINDOW_MESSAGES=500
