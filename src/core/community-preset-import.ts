import {createHash} from 'node:crypto'
import {extractCommunityPresetProfile} from './community-preset-profiles.js'
import {annotateCommunityIzumiPrompts} from './community-preset-plans.js'
import type {
  CommunityJson,CommunityMarker,CommunityPresetParseOptions,CommunityPresetPrompt,
  CommunityPresetV1,CommunityRegexRule,
} from './community-preset-types.js'

export const COMMUNITY_PRESET_MARKERS:readonly CommunityMarker[]=[
  'worldInfoBefore','worldInfoAfter','charDescription','charPersonality',
  'scenario','personaDescription','dialogueExamples','chatHistory',
]
const record=(value:unknown):Record<string,CommunityJson>=>
  value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,CommunityJson>:{}
const array=(value:unknown):CommunityJson[]=>Array.isArray(value)?value:[]
const text=(value:unknown,fallback='')=>typeof value==='string'?value:fallback
const number=(value:unknown,fallback:number)=>typeof value==='number'?value:fallback

export function normalizeCommunityRegexes(value:unknown):CommunityRegexRule[] {
  const rules=Array.isArray(value)?value:[value]
  return rules.filter(item=>item&&typeof item==='object').map((item,index)=>{
    const values=record(item),raw=Object.hasOwn(values,'raw')?record(values.raw):values
    const placement=Array.isArray(values.placement)?values.placement:String(values.placement??'').split(/[\s,]+/).filter(Boolean)
    const trims=Array.isArray(values.trimStrings)?values.trimStrings:[values.trimStrings]
    return {
      id:text(values.id,`regex-${index+1}`),scriptName:text(values.scriptName??values.script_name??values.name,`Regex ${index+1}`),
      findRegex:text(values.findRegex??values.find_regex),replaceString:text(values.replaceString??values.replace_string),
      trimStrings:trims.filter((v):v is string=>typeof v==='string'&&v!==''),
      placement:placement.map(Number),disabled:values.disabled===true||values.enabled===false,
      markdownOnly:values.markdownOnly===true,promptOnly:values.promptOnly===true,runOnEdit:values.runOnEdit===true,
      substituteRegex:number(values.substituteRegex,0),minDepth:typeof values.minDepth==='number'?values.minDepth:null,
      maxDepth:typeof values.maxDepth==='number'?values.maxDepth:null,raw,
    }
  })
}

export function parseCommunityPreset(input:unknown,options:CommunityPresetParseOptions):CommunityPresetV1 {
  const raw=record(input)
  if(!Array.isArray(raw.prompts))throw Error('社区预设需要 prompts 数组')
  const orders=array(raw.prompt_order).map(record)
  const selected=orders.find(order=>Number(order.character_id)===100001)??orders[0]
  const promptOrder=array(selected?.order).map(item=>{
    const entry=record(item);return {identifier:text(entry.identifier),enabled:entry.enabled!==false}
  })
  const ordered=new Map(promptOrder.map(entry=>[entry.identifier,entry]))
  const prompts:CommunityPresetPrompt[]=raw.prompts.map((item,index)=>{
    const p=record(item),identifier=text(p.identifier,`prompt-${index+1}`),order=ordered.get(identifier)
    return {
      identifier,name:text(p.name,identifier),content:text(p.content),
      role:p.role==='user'||p.role==='assistant'?p.role:'system',enabled:order?.enabled??p.enabled!==false,
      marker:COMMUNITY_PRESET_MARKERS.includes(identifier as CommunityMarker)?identifier as CommunityMarker:null,
      injectionPosition:number(p.injection_position,0),injectionDepth:number(p.injection_depth,4),
      injectionOrder:number(p.injection_order,100),readOnly:p.readOnly===true,hidden:p.spreset_hidden===true,
      configurationOnly:/^spreset(?:[_\s-]|$)/i.test(identifier)||/^SPreset(?:配置|设置|$)/i.test(text(p.name)),
      unused:selected!==undefined&&!order,raw:p,
    }
  })
  const extensions=record(raw.extensions),spreset=record(extensions.SPreset)
  const candidates:[CommunityPresetV1['regexSource'],unknown][]=[
    ['native',extensions.regex_scripts],['spreset',record(spreset.RegexBinding).regexes],
    ['legacy',raw.regex_scripts??extensions.regexes??raw.regexes],
  ]
  const chosen=candidates.find(([,value])=>Array.isArray(value)&&value.length>0)
  const parameters=Object.fromEntries(Object.entries(raw).filter(([key])=>!['prompts','prompt_order','extensions'].includes(key)))
  const rawText=options.rawText||JSON.stringify(raw)
  const profile=extractCommunityPresetProfile(raw,prompts)
  if(profile.id==='izumi')annotateCommunityIzumiPrompts(prompts,promptOrder)
  return {
    schema:'community-presets.v1',version:1,id:options.id,name:options.name,
    source:{fileName:options.fileName??'',sha256:createHash('sha256').update(rawText).digest('hex'),
      version:raw.version??raw.preset_version??null,rawText,raw},
    prompts,promptOrder,characterId:selected?Number(selected.character_id):null,
    regexes:chosen?normalizeCommunityRegexes(chosen[1]):[],regexSource:chosen?.[0]??'none',parameters,profile,
  }
}
