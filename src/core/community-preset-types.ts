/** Imported community data is inert. Script sources remain in raw, never executable. */
export type CommunityJson = null | boolean | number | string | CommunityJson[] | {[key:string]:CommunityJson}
export type CommunityPresetProfileId = string
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
export interface CommunityPresetOrder extends Record<string,CommunityJson> {identifier:string;enabled:boolean}
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
  /** Native profile DATA. Module predicates are immutable private indices. */
  configuration:Record<string,CommunityJson>
  /** Complete committed control inputs in this working preset's scope. */
  controlAnswers?:Record<string,CommunityJson>
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
  /** Current mutable extension content. Absent only in older persisted v1 rows. */
  extensions?:Record<string,CommunityJson>
  contentRevision?:number
  profile:CommunityPresetProfile
}
export function orderedCommunityPresetPrompts(preset:CommunityPresetV1):CommunityPresetPrompt[] {
  const byId=new Map(preset.prompts.map(prompt=>[prompt.identifier,prompt]))
  return preset.promptOrder.length
    ?preset.promptOrder.flatMap(row=>byId.get(row.identifier)??[])
    :preset.prompts
}
export function isAuxiliaryCommunityPrompt(prompt:CommunityPresetPrompt):boolean {
  return !prompt.marker&&!prompt.sectionBoundary&&!prompt.configurationOnly
}
export interface CommunityPresetDataPromptV1 {
  id:string
  name:string
  enabled:boolean
  role:CommunityPromptRole
  position?:{type:'relative'}|{type:'in_chat';depth:number;order:number}
  content?:string
  extra?:Record<string,CommunityJson>
}
export interface CommunityPresetDataV1 {
  settings:Record<string,CommunityJson>
  prompts:CommunityPresetDataPromptV1[]
  prompts_unused:CommunityPresetDataPromptV1[]
  extensions:Record<string,CommunityJson>
}
export const COMMUNITY_PRESET_DEFAULT_SETTINGS_V1:Readonly<Record<string,CommunityJson>>={
  max_context:2000000,max_completion_tokens:300,reply_count:1,should_stream:false,temperature:1,
  frequency_penalty:0,presence_penalty:0,repetition_penalty:1,top_p:1,min_p:0,top_k:0,top_a:0,seed:-1,
  squash_system_messages:false,reasoning_effort:'auto',request_thoughts:false,request_images:false,
  enable_function_calling:false,enable_web_search:false,allow_sending_images:'disabled',allow_sending_videos:false,
  character_name_prefix:'none',wrap_user_messages_in_quotes:false,
}
/** The browser and canonical importer expose the same fixed Helper defaults. */
export function communityDefaultPresetDataV1():CommunityPresetDataV1 {
  const order:CommunityMarker[]=['worldInfoBefore','personaDescription','charDescription','charPersonality','scenario',
    'worldInfoAfter','dialogueExamples','chatHistory'],names:Record<CommunityMarker,string>={
      worldInfoBefore:'World Info (before) - 角色定义之前',personaDescription:'Persona Description - 玩家描述',
      charDescription:'Char Description - 角色描述',charPersonality:'Char Personality - 角色性格',scenario:'Scenario - 情景',
      worldInfoAfter:'World Info (after) - 角色定义之后',dialogueExamples:'Chat Examples - 对话示例',chatHistory:'Chat History - 聊天记录'}
  return {settings:structuredClone(COMMUNITY_PRESET_DEFAULT_SETTINGS_V1),prompts:order.map(id=>({id,name:names[id],
    enabled:true,position:{type:'relative'},role:'system'})),prompts_unused:[],
    extensions:{tavern_helper:{scripts:[],variables:{}}}}
}
export type CommunityAuthorPresetTargetV1=
  |{readonly kind:'saved';readonly presetId:string}
  |{readonly kind:'in-use';readonly conversationId:string}
export interface CommunityAuthorPresetOriginV1 {
  readonly profileId:string
  readonly sessionId:string
  readonly realmId:string
  readonly groupId:string
  readonly sourceRecordSessionId:string|null
  readonly importId:string|null
}
export type CommunityAuthorPresetCommandV1=
  |{readonly kind:'create';readonly name:string;readonly data?:CommunityPresetDataV1}
  |{readonly kind:'create-or-replace';readonly name:string;readonly data?:CommunityPresetDataV1}
  |{readonly kind:'replace';readonly target:CommunityAuthorPresetTargetV1;readonly data:CommunityPresetDataV1}
  |{readonly kind:'delete';readonly presetId:string|null;readonly name:string}
  |{readonly kind:'load';readonly presetId:string|null;readonly name:string}
  |{readonly kind:'rename';readonly presetId:string|null;readonly name:string;readonly newName:string}
  |{readonly kind:'replace-global-regexes';readonly rules:readonly Readonly<Record<string,CommunityJson>>[]}
  |{readonly kind:'replace-preset-regexes';readonly target:CommunityAuthorPresetTargetV1;
    readonly rules:readonly Readonly<Record<string,CommunityJson>>[]}
export interface CommunityAuthorPresetOperationV1 {
  readonly schemaVersion:1
  readonly operationId:string
  readonly origin:CommunityAuthorPresetOriginV1
  readonly expectedRevision:number
  readonly command:CommunityAuthorPresetCommandV1
}
/** The state owner knows this operation has not reached acceptance. */
export class CommunityAuthorPresetRefusalV1 extends Error {
  constructor(readonly operationId:string,readonly code:string) {
    super(code)
    this.name='CommunityAuthorPresetRefusalV1'
  }
}
export type CommunityAuthorPresetResolvedTargetV1=
  |{readonly kind:'saved';readonly presetId:string}
  |{readonly kind:'in-use';readonly conversationId:string;readonly presetId:string}
  |{readonly kind:'global-regexes'}
export interface CommunityAuthorPresetReceiptV1 {
  readonly schemaVersion:1
  readonly operationId:string
  readonly payloadSha256:string
  readonly origin:CommunityAuthorPresetOriginV1
  readonly target:CommunityAuthorPresetResolvedTargetV1|null
  readonly result:{readonly kind:'boolean';readonly value:boolean}|{readonly kind:'void'}
  readonly assignedIds:Readonly<Record<string,string>>
  readonly revision:number
}
export interface CommunityAuthorPresetResultV1 {
  readonly receipt:CommunityAuthorPresetReceiptV1
  readonly target:CommunityAuthorPresetResolvedTargetV1|null
  readonly value?:boolean
  readonly data?:CommunityPresetDataV1
  readonly scopeVariables?:{readonly presetId:string;readonly values:Readonly<Record<string,CommunityJson>>}
}
export interface CommunityAuthorPresetCatalogV1 {
  readonly schemaVersion:1
  readonly encoding:'community-author-preset-catalog-v1'
  readonly revision:number
  readonly conversationId:string
  readonly names:readonly string[]
  readonly loaded:{readonly presetId:string;readonly name:string}|null
  readonly current:{readonly presetId:string|null;readonly data:CommunityPresetDataV1}
  readonly presets:readonly {readonly presetId:string;readonly name:string;readonly revision:number;
    readonly data:CommunityPresetDataV1}[]
  readonly globalRegexes:readonly Readonly<Record<string,CommunityJson>>[]
}
export interface CommunityPresetParseOptions {id:string;name:string;fileName?:string;rawText?:string}

/** UI and controls consume the same Core-published range, without regex work. */
export function communityBetweenOptions(preset:CommunityPresetV1,option:CommunityPresetControlOption):CommunityPresetPrompt[] {
  if(!option.match)return []
  const ids=Array.isArray(option.raw.resolvedPromptIds)?option.raw.resolvedPromptIds:[]
  const byId=new Map(preset.prompts.map(prompt=>[prompt.identifier,prompt]))
  return ids.map(id=>typeof id==='string'?byId.get(id):undefined)
    .filter((prompt):prompt is CommunityPresetPrompt=>!!prompt)
}

/** Prompt identities and fallback names have the same meaning in controls and their UI. */
export function communityPresetConfiguredPromptV1(preset:CommunityPresetV1,declaration:Record<string,CommunityJson>) {
  return preset.prompts.find(prompt=>prompt.identifier===declaration.stableId)
    ??preset.prompts.find(prompt=>Array.isArray(declaration.nameFallbacks)&&declaration.nameFallbacks.includes(prompt.name))
}

/** The existing parameter writer replaces one balanced setvar body without evaluating macros. */
export function communityPresetParameterSpanV1(content:string,key:string) {
  const opener=`{{setvar::${key}::`,start=content.indexOf(opener)
  if(start<0)return undefined
  const valueStart=start+opener.length
  let end=valueStart,nesting=1
  while(end<content.length&&nesting) {
    if(content.startsWith('{{',end)){nesting++;end+=2}
    else if(content.startsWith('}}',end)){nesting--;end+=2}
    else end++
  }
  return {start,valueStart,end,valueEnd:nesting?end:end-2}
}

/** Drafts stay in the panel. Committed parameter text belongs to its actual target prompt. */
export function communityPresetParameterValueV1(preset:CommunityPresetV1,option:CommunityPresetControlOption,
  variable:Record<string,CommunityJson>):CommunityJson|undefined {
  const configuration=preset.profile.configuration[preset.profile.id],
    registry=configuration&&typeof configuration==='object'&&!Array.isArray(configuration)
      &&Array.isArray(configuration.configurablePrompts)?configuration.configurablePrompts:[],
    declaration=registry.find(item=>item&&typeof item==='object'&&!Array.isArray(item)&&item.key===option.id),
    prompt=communityPresetConfiguredPromptV1(preset,declaration&&typeof declaration==='object'&&!Array.isArray(declaration)
      ?declaration:option.raw)
  if(prompt) {
    if(variable.wholeContent===true)return prompt.content
    const key=String(variable.variable??variable.id??variable.name??variable.key??''),
      span=communityPresetParameterSpanV1(prompt.content,key)
    if(span)return prompt.content.slice(span.valueStart,span.valueEnd)
  }
  return variable.default
}

/** Old rows derive their first answer set from published prompts and declared defaults. */
export function communityPresetControlStateV1(preset:CommunityPresetV1):Record<string,CommunityJson> {
  if(preset.profile.controlAnswers)return preset.profile.controlAnswers
  const answers:Record<string,CommunityJson>=Object.create(null)
  for(const group of preset.profile.groups)for(const option of group.options) {
    if(option.type==='parameters') {
      const variables=Array.isArray(option.raw.variables)?option.raw.variables:[]
      for(const variable of variables)if(variable&&typeof variable==='object'&&!Array.isArray(variable)) {
        const key=String(variable.name??variable.key??''),value=communityPresetParameterValueV1(preset,option,variable)
        if(value!==undefined)answers[key]=value
      }
      continue
    }
    const targets=option.type==='between'?communityBetweenOptions(preset,option)
      :preset.prompts.filter(prompt=>option.enable.includes(prompt.identifier)||option.enable.includes(prompt.name))
    if(option.id==='none') {
      answers[option.id]=!preset.prompts.some(prompt=>group.disableGroup.includes(prompt.identifier)&&prompt.enabled)
    }else if(!targets.length)answers[option.id]=option.raw.default===true
    else if(option.type==='between')answers[option.id]=targets.some(prompt=>prompt.enabled)
    else answers[option.id]=targets.every(prompt=>prompt.enabled)
  }
  return answers
}
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
