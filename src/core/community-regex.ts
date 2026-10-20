import {recordSha256,sha256} from './roleplay-data.js'
import {applyTavernPromptTransformsV1} from './tavern-prompt-transform.mjs'
import type {TavernPromptBindingV1,TavernPromptMacroSnapshotV1,TavernPromptRegexRuleV1,
  TavernPromptTransformEntryV1} from './tavern-prompt-transform-types.mjs'
import type {CommunityPresetPolicy,CommunityRegexOrigin} from './community-presets.js'
import type {CommunityRegexRule,CommunityJson} from './community-preset-types.js'
import {TAVERN_PROMPT_TRANSFORM_LIMITS_V1} from './tavern-prompt-transform-types.mjs'

export function communityRegexRules(policy:CommunityPresetPolicy,
  scoped:readonly TavernPromptRegexRuleV1[]=[]):TavernPromptRegexRuleV1[] {
  const rules:TavernPromptRegexRuleV1[]=[]
  const append=(source:readonly CommunityRegexRule[],origin:CommunityRegexOrigin,owner:string)=>{
    for(const [index,rule] of source.entries())rules.push({id:`${owner}:${index}:${rule.id}`,
      sourcePointer:`/community/${owner}/${index}`,sourceSnapshotSha256:policy.fingerprint,origin,allowed:true,
      disabled:rule.disabled,findRegex:rule.findRegex,replaceString:rule.replaceString,trimStrings:rule.trimStrings,
      placement:rule.placement as TavernPromptRegexRuleV1['placement'],promptOnly:rule.promptOnly,
      markdownOnly:rule.markdownOnly,runOnEdit:rule.runOnEdit,minDepth:rule.minDepth,maxDepth:rule.maxDepth,
      substituteRegex:rule.substituteRegex as 0|1|2})
  }
  if(policy.preset)append(policy.preset.regexes,'preset',policy.preset.id)
  for(const library of policy.regexes)append(library.rules,library.binding.scope==='preset'?'preset':
    library.binding.scope==='conversation'?'scoped':'global',library.id)
  rules.push(...scoped.map(rule=>({...rule,id:`card:${rule.id}`})))
  return rules.sort((a,b)=>policy.regexOrder.indexOf(a.origin)-policy.regexOrder.indexOf(b.origin))
}

export function communityRegexMacros(aliases:Record<string,string>,chat:Record<string,CommunityJson>,
  global:Record<string,CommunityJson>,sourceSha256:string):TavernPromptMacroSnapshotV1 {
  const binding=(key:string,value:string,scope:'chat'|'global'|'card'='card'):TavernPromptBindingV1=>({key,value,
    valueSha256:sha256(value),read:{kind:'variable',purpose:'read',scope,ownerId:`community:${scope}`,key,
      present:true,versionSha256:sourceSha256,valueSha256:recordSha256(value),entryId:null,sourcePointer:null}})
  const user=aliases.user??'用户',char=aliases.char??'角色'
  return {schemaVersion:1,engine:'legacy',authority:'consumer-data-only',sourceSnapshotSha256:sourceSha256,
    names:{user:binding('user',user),char:binding('char',char),group:binding('group',char),
      charIfNotGroup:binding('charIfNotGroup',char),groupNotMuted:binding('groupNotMuted',char),
      notChar:binding('notChar',user),model:binding('model',aliases.model??'')},card:null,input:binding('input',aliases.input??''),
    instruct:[],dynamic:Object.entries(aliases).filter(([key])=>!['user','char','model','input'].includes(key))
      .map(([key,value])=>binding(key,value)),registered:[],outlets:[],post:[],characterOverrides:[],
    localVariables:Object.entries(chat).map(([key,value])=>binding(key,typeof value==='string'?value:JSON.stringify(value),'chat')),
    globalVariables:Object.entries(global).map(([key,value])=>binding(key,typeof value==='string'?value:JSON.stringify(value),'global'))}
}
export async function applyCommunityRegex(policy:CommunityPresetPolicy,
  entries:readonly TavernPromptTransformEntryV1[],macros:TavernPromptMacroSnapshotV1,
  scoped:readonly TavernPromptRegexRuleV1[]=[],signal?:AbortSignal) {
  const rules=communityRegexRules(policy,scoped)
  if(!rules.some(rule=>!rule.disabled))return entries.map(entry=>entry.inputText)
  // Independent message strings share frozen rules/macros, not mutable state.
  // Bound the actual text per worker so a 500-row Reader page does not become
  // one oversized packet or borrow a longer regex deadline. Never split prose
  // inside a message: anchors and cross-line expressions keep their meaning.
  const batchChars=Math.min(64_000,Math.floor(TAVERN_PROMPT_TRANSFORM_LIMITS_V1.workChars/(2*rules.length)))
  const output:string[]=[],batch:TavernPromptTransformEntryV1[]=[]
  let chars=0
  const flush=async()=>{
    if(!batch.length)return
    const result=await applyTavernPromptTransformsV1({schemaVersion:1,encoding:'owned-tavern-prompt-transform-v1',
      authority:'consumer-data-only',sourceSnapshotSha256:policy.fingerprint,regexDisabled:false,
      scriptOrder:policy.regexOrder,macros,rules,entries:batch},{signal,assertCurrent:()=>signal?.throwIfAborted()})
    if(result.kind!=='transformed')throw Error(result.diagnostics[0]?.code??'社区正则执行失败')
    output.push(...result.output.entries.map(entry=>entry.outputText))
    batch.length=0;chars=0
  }
  for(const entry of entries){
    if(batch.length&&(batch.length>=40||chars+entry.inputText.length>batchChars))await flush()
    batch.push(entry);chars+=entry.inputText.length
  }
  await flush()
  return output
}
export function communityRegexEntry(key:string,inputText:string,sourceSha256:string,
  options:{channel:'prompt'|'display'|'source';placement:0|1|2|3|4|5|6;depth:number|null;isEdit?:boolean})
  :TavernPromptTransformEntryV1 {
  return {key,bookId:null,entryId:null,sourcePointer:`/community/messages/${key}`,sourceSnapshotSha256:sourceSha256,
    rawText:inputText,storyText:inputText,inputText,pipeline:'regex-only',channel:options.channel,
    placement:options.placement,depth:options.depth,isEdit:options.isEdit??false,characterOverride:null,required:true}
}
