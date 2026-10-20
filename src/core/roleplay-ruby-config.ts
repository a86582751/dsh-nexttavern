/** Fixed caller: RUBY/src/config.js normalizeConfigData/normalizePreset/
 * normalizeTask/normalizePositions; scheduler.js cycleLength. No task starts here. */
import type {RubyConfigurationV1,RubyIssueV1,RubyMessageItemV1,RubySourceRefV1,RubyTaskV1}
  from './roleplay-ruby-types.js'

type Data=Readonly<Record<string,unknown>>
const object=(value:unknown):Data=>value!==null&&typeof value==='object'&&!Array.isArray(value)
  ?value as Data:{}
const text=(value:unknown)=>String(value||'')
const strings=(value:unknown)=>Array.isArray(value)?value.map(String):[]
const number=(value:unknown,fallback:number)=>Number.isFinite(Number(value))?Number(value):fallback
const issue=(code:string,sourcePath:string):RubyIssueV1=>({code,sourcePath})

// Only the upstream lookup metadata is known. The built-in body has no
// redistribution grant, so a real author-owned book must supply its content.
export const RUBY_BUILTIN_REFERENCES_V1=Object.freeze([
  Object.freeze({entryKey:'约束库',varName:'constraintLibrary',label:'约束库'}),
])

export function rubyCyclePositionsV1(raw:unknown):number[] {
  const values=Array.isArray(raw)?raw:typeof raw==='string'?raw.split(','):
    Number.isFinite(Number(raw))?[Number(raw)]:[]
  return [...new Set(values.map(value=>parseInt(String(value),10))
    .filter(value=>Number.isFinite(value)&&value>0))].sort((a,b)=>a-b)
}
export function rubyMessageItemsV1(raw:unknown):RubyMessageItemV1[] {
  return (Array.isArray(raw)?raw:[]).map((value,index)=>{
    const row=object(value),position=row.position,role=row.role
    return {id:text(row.id)||`custom_${index}`,enabled:row.enabled!==false,
      position:position==='afterUser'||position==='tail'?position:'beforeUser',
      role:role==='assistant'||role==='user'?role:'system',content:text(row.content)}
  })
}
function taskData(raw:unknown,index:number,root:string):RubyTaskV1 {
  const row=object(raw),id=Number(row.id)||0,sourcePath=`${root}/tasks/${index}`,
    cyclePositions=rubyCyclePositionsV1(row.cyclePositions??row.cyclePosition??row.triggerFloor),
    keywords=Array.isArray(row.keywordScanKeywords)?row.keywordScanKeywords:
      typeof row.keywordScanKeywords==='string'?row.keywordScanKeywords.split(','):[]
  return {id,taskKey:`task_${id}`,sourcePath,enabled:row.enabled!==false,
    displayName:text(row.displayName)||`任务#${row.id||'?'}`,cyclePositions,
    promptKey:text(row.promptKey),outputKey:text(row.outputKey),outputVarName:text(row.outputVarName)||`task_${row.id||0}_Output`,
    extraKeys:text(row.extraKeys),enableJailbreak:row.enableJailbreak!==false,
    outputConstant:!!row.outputConstant,outputDisable:!!row.outputDisable,selective:!!row.selective,
    selectiveKeys:strings(row.selectiveKeys),noRecursion:!!row.noRecursion,
    position:number(row.position,0),depth:number(row.depth,4),order:number(row.order,100),
    keywordScanEnabled:!!row.keywordScanEnabled,
    keywordScanKeywords:keywords.map(value=>String(value).trim()).filter(Boolean),
    useReferences:strings(row.useReferences),useOutputs:strings(row.useOutputs),issues:[]}
}

export function readRubyConfigurationV1(raw:unknown,source:RubySourceRefV1):RubyConfigurationV1 {
  const data=object(raw),presets=Array.isArray(data.presets)?data.presets:[],
    requested=text(data.activePresetId),selected=presets.findIndex(value=>text(object(value).id)===requested),
    index=selected>=0?selected:0,preset=object(presets[index]),root=`${source.sourcePath}/presets/${index}`,
    tasks=(Array.isArray(preset.tasks)?preset.tasks:[]).map((value,ordinal)=>taskData(value,ordinal,root)),
    enabled=tasks.filter(task=>task.enabled),startup=object(preset.startupTask),issues:RubyIssueV1[]=[]
  const hasProducer=enabled.length>0||!!startup.enabled||!!object(preset.director).enabled
  if(hasProducer) {
    if(startup.enabled)issues.push(issue('RUBY_STARTUP_EXECUTION_UNSUPPORTED',root+'/startupTask'))
    if(object(preset.director).enabled)issues.push(issue('RUBY_DIRECTOR_EXECUTION_UNSUPPORTED',root+'/director'))
    if(['littlewhitebox','shujuku','yuzuki','baibaibook'].includes(text(data.summaryProvider)))
      issues.push(issue('RUBY_SUMMARY_PROVIDER_UNSUPPORTED',source.sourcePath+'/summaryProvider'))
    if(object(data.gen).enabled===true)issues.push(issue('RUBY_GENERATION_OPTIONS_UNSUPPORTED',source.sourcePath+'/gen'))
  }
  const messageRows=object(data.jailbreak).items,
    messageItems=Array.isArray(messageRows)&&messageRows.length?rubyMessageItemsV1(messageRows):null
  if(hasProducer&&!messageItems)issues.push(issue('RUBY_DEFAULT_MESSAGES_UNAVAILABLE',source.sourcePath+'/jailbreak'))
  const referencePool=(Array.isArray(preset.referencePool)?preset.referencePool:[]).map(value=>{
    const row=object(value)
    return {entryKey:text(row.entryKey),varName:text(row.varName),label:text(row.label||row.entryKey||row.varName)}
  }).filter(row=>row.entryKey&&row.varName)
  const cycleLength=enabled.reduce((maximum,task)=>Math.max(maximum,...task.cyclePositions),0)
  return {schemaVersion:1,encoding:'ruby-static-configuration-data-v1',source,
    status:issues.length?'unsupported':!hasProducer?'empty':'supported-static',activePresetId:text(preset.id),
    charName:text(data.charName),customContentTags:Array.isArray(data.customContentTags)
      ?data.customContentTags.filter((value):value is string=>typeof value==='string'&&!!value.trim()):[],
    referencePool,tasks,messageItems,cycleLength,issues,requestsPerEligibleTask:1}
}
