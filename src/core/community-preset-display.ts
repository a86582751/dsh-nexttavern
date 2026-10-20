import {recordSha256} from './roleplay-data.js'
import {applyCommunityRegex,communityRegexEntry,communityRegexMacros} from './community-regex.js'
import type {CommunityPresetPolicy} from './community-presets.js'
import type {CommunityRegexRule,CommunityJson} from './community-preset-types.js'
import {COMMUNITY_READER_WINDOW_MESSAGES} from './community-preset-types.js'
import type {TavernPromptRegexRuleV1} from './tavern-prompt-transform-types.mjs'

export interface CommunityDisplayMessage {
  seq:number
  messageId:string
  role:'user'|'assistant'
  text:string
  depth:number
  isEdit:boolean
}
export interface CommunityDisplayInput {
  messages:readonly CommunityDisplayMessage[]
  aliases:Record<string,string>
  chat:Record<string,CommunityJson>
  global:Record<string,CommunityJson>
  scopedRules:readonly TavernPromptRegexRuleV1[]
}
// These identifiers are the inspected sample's declared display widgets. Their
// imported scripts are retained for export, while the display path emits only
// owned markup. Other rules keep the normal bounded ST Worker semantics.
const options=new Map([
  ['6d75d31a-05e7-4996-b681-05f5ca71187b','izumi'],['3985affa-af67-4c4a-a5c6-a853d212f209','izumi'],
  ['cd7d963f-e7e1-417f-a018-44f8e34a9339','lines'],['58600925-c20f-485a-9453-1ff3b0e62aa2','lines'],
])
const thinking=new Set(['af0520bc-7399-4ef8-935f-9f1e4aa96be0','5c7c4aa4-304a-4d8c-a0a4-a142405477b7',
  'a1a57b61-8f66-4956-bd0c-386c0356e232','69ddfba5-b9af-4fea-9d96-490d85f6b66f',
  'bdae9a30-78dc-4241-a9a1-4b02f561a571','80ebc9b6-6e2e-40bb-807a-b3cfebd23bc5'])
const bubbles=new Set(['0d90e123-6f62-42b2-aa1a-1e19b71e9581','cf29048e-fd3d-49c9-a18e-ad1ce5862a6e',
  'e475633f-9e50-407c-81e8-9ee94758c2a8','2026416e-2401-4ceb-8a92-800463ae50ef','7f4c0efa-733a-46a5-beab-d529e1291208'])
export function nativeCommunityDisplayRule(rule:CommunityRegexRule):CommunityRegexRule {
  let replacement:string|undefined
  let findRegex=rule.findRegex
  if(options.has(rule.id)) {
    const tag=rule.id==='cd7d963f-e7e1-417f-a018-44f8e34a9339'?'SUOT':'options'
    findRegex=`/<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>/gi`
    replacement=`<div class="community-options" data-community-options="${options.get(rule.id)}"><pre>$1</pre></div>`
  }
  else if(thinking.has(rule.id))replacement='<details class="community-thinking"><summary>思考</summary><div>$1</div></details>'
  else if(bubbles.has(rule.id))replacement='<details class="community-bubble"><summary>💬</summary><div>$1</div></details>'
  else if(rule.id==='18ac3aa0-48f2-48c9-843f-5fec393ebe35')replacement='<aside class="community-danmu">$1</aside>'
  return replacement===undefined?rule:{...rule,findRegex,replaceString:replacement}
}

export function createCommunityPresetDisplay() {
  const cache=new Map<string,{text:string;bytes:number}>()
  let bytes=0
  function remember(key:string,text:string,active:ReadonlySet<string>) {
    const size=Buffer.byteLength(text)
    bytes-=cache.get(key)?.bytes??0
    cache.set(key,{text,bytes:size});bytes+=size
    while(cache.size>COMMUNITY_READER_WINDOW_MESSAGES||bytes>8_388_608) {
      const oldest=[...cache.keys()].find(key=>!active.has(key))??cache.keys().next().value!
      bytes-=cache.get(oldest)!.bytes;cache.delete(oldest)
    }
  }
  async function render(policy:CommunityPresetPolicy,input:CommunityDisplayInput,
    refs:readonly {seq:number;messageId:string}[],signal?:AbortSignal) {
    const started=performance.now(),adapted={...policy,
      preset:policy.preset?{...policy.preset,regexes:policy.preset.regexes.map(nativeCommunityDisplayRule)}:null,
      regexes:policy.regexes.map(library=>({...library,rules:library.rules.map(nativeCommunityDisplayRule)}))}
    const current=new Map(input.messages.map(message=>[`${message.seq}:${message.messageId}`,message]))
    const basis=recordSha256({policy:policy.fingerprint,aliases:input.aliases,chat:input.chat,
      global:input.global,scopedRules:input.scopedRules})
    const messages=refs.map(ref=>current.get(`${ref.seq}:${ref.messageId}`)).filter((row):row is CommunityDisplayMessage=>!!row)
    const keys=messages.map(message=>recordSha256({basis,message}))
    const active=new Set(keys)
    const results=new Map(keys.flatMap(key=>cache.has(key)?[[key,cache.get(key)!.text] as const]:[]))
    const missing=messages.flatMap((message,index)=>results.has(keys[index]!)?[]:[{message,index,key:keys[index]!}])
    if(missing.length) {
      const output=await applyCommunityRegex(adapted,missing.map(({message,key})=>communityRegexEntry(key,message.text,basis,
        {channel:'display',placement:message.role==='user'?1:2,depth:message.depth,isEdit:message.isEdit})),
      communityRegexMacros(input.aliases,input.chat,input.global,basis),input.scopedRules,signal)
      signal?.throwIfAborted()
      for(const [index,item] of missing.entries()){results.set(item.key,output[index]!);remember(item.key,output[index]!,active)}
    }
    return {fingerprint:basis,results:messages.map((message,index)=>({seq:message.seq,messageId:message.messageId,
      sourceText:message.text,text:results.get(keys[index]!)!,depth:message.depth})),
      performance:{elapsedMs:performance.now()-started,processed:missing.length,reused:messages.length-missing.length}}
  }
  return {render}
}
