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
// Native presentation is an explicit author choice. Identity survives author
// edits and copies, so neither an imported UUID nor source text grants it.
export function nativeCommunityDisplayRule(rule:CommunityRegexRule):CommunityRegexRule {
  const widget=rule.raw.nexttavernWidget
  let replacement:string|undefined
  if(widget==='options-izumi'||widget==='options-lines') {
    replacement=`<div class="community-options" data-community-options="${widget==='options-izumi'?'izumi':'lines'}"><pre>$1</pre></div>`
  }
  else if(widget==='thinking')replacement='<details class="community-thinking"><summary>思考</summary><div>$1</div></details>'
  else if(widget==='bubble')replacement='<details class="community-bubble"><summary>💬</summary><div>$1</div></details>'
  else if(widget==='danmu')replacement='<aside class="community-danmu">$1</aside>'
  return replacement===undefined?rule:{...rule,replaceString:replacement}
}

export function communityDisplayPolicy(policy:CommunityPresetPolicy):CommunityPresetPolicy {
  return {...policy,preset:policy.preset?{...policy.preset,regexes:policy.preset.regexes.map(nativeCommunityDisplayRule)}:null,
    regexes:policy.regexes.map(library=>({...library,rules:library.rules.map(nativeCommunityDisplayRule)}))}
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
    const started=performance.now(),adapted=communityDisplayPolicy(policy)
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
