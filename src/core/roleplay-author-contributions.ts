/** The ordinary author prompt and a material residual use one field-level
 * producer. These references describe text; they never grant input authority. */
import {keyOf,recordSha256,sha256} from './roleplay-data.js'
import {statusAuthorRules} from '../status-template.js'
import type {AuthorRecord,AuthorTables,AuthorTable} from './roleplay-author-context-types.js'

export interface AuthorContributionRowV1 {
  readonly table:'cards'|'worldbook'|'rules'|'status'
  readonly key:string
  readonly exists:boolean
  readonly sha256:string
}
export interface AuthorContributionPartV1 {
  readonly identity:string
  readonly kind:'card'|'core'|'always-on'|'plot'|'narrative'|'reply'|'examples'|'worldbook-query'|'status'
  readonly row:AuthorContributionRowV1|null
  readonly field:string|null
  readonly originalText:string
  readonly originalTextSha256:string
  readonly text:string
  readonly textSha256:string
}
export interface AuthorContributionProjectionV1 {
  readonly schemaVersion:1
  readonly authority:'consumer-data-only'
  readonly rulesRowSha256:string
  readonly beforeCoreSha256:string
  readonly residualCore:string
  readonly worldbookMembershipSha256:string
  readonly suppressAlwaysOn:readonly {readonly key:string;readonly sha256:string}[]
  /** Example text moves to the independently owned examples section only in
   * an admitted material request. Ordinary assembly keeps its original bytes. */
  readonly splitExamples:boolean
  readonly nativeLoreReadPolicy?:'automatic'
}
export interface AuthorContributionDataV1 {
  readonly schemaVersion:1
  readonly encoding:'roleplay-author-field-contributions-v1'
  readonly authority:'consumer-data-only'
  readonly sessionId:string
  readonly includeCardStyle:boolean
  readonly cardsText:string
  readonly rulesText:string
  readonly examplesText:string
  readonly parts:readonly AuthorContributionPartV1[]
  readonly residentParts:readonly {readonly section:string;readonly name:string;readonly text:string}[]
  readonly rows:readonly AuthorContributionRowV1[]
  readonly cardsMembershipSha256:string
  readonly worldbookMembershipSha256:string
  readonly dataSha256:string
}
type Tables=AuthorTables&{status:AuthorTable}
const compare=([left]:readonly [string,unknown],[right]:readonly [string,unknown])=>left<right?-1:left>right?1:0
const branchRows=(table:AuthorTable,id:string)=>[...table.entries()]
  .filter(([key])=>key.startsWith(`${id}__`)).sort(compare)
const text=(value:unknown)=>String(value??'')
const rowRef=(table:AuthorContributionRowV1['table'],key:string,value:unknown):AuthorContributionRowV1=>
  ({table,key,exists:value!==undefined&&value!==null,sha256:recordSha256(value)})
function fail(code:string):never {throw Error(code)}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'){for(const item of Object.values(value))freeze(item);Object.freeze(value)}
  return value
}

export function renderWorldbookEntry(e:AuthorRecord):string {
  const lines=[`【${e.name??e.id}】(id: ${e.id}, 类型: ${e.kind??'term'}, 优先级: ${e.priority??0}${e.locked?', 锁定':''})`]
  if(Array.isArray(e.aliases)&&e.aliases.length)lines.push(`别名：${e.aliases.join('、')}`)
  if(Array.isArray(e.keywords)&&e.keywords.length)lines.push(`关键词：${e.keywords.join('、')}`)
  if(e.content)lines.push(e.content)
  return lines.join('\n')
}
export function renderCards(T:Pick<AuthorTables,'cards'>,branchId:string):string {
  return branchRows(T.cards,branchId).filter(([,value])=>!!value).map(([,value])=>{
    const lines=[`## 角色卡：${value.name??value.id}${value.kind==='user'?'（玩家角色 {{user}}）':value.kind==='npc'?'（NPC）':''}`]
    if(value.content)lines.push(value.content)
    if(value.locked===true)lines.push('（本卡含锁定事实）')
    return lines.join('\n')
  }).join('\n\n')
}

export function produceAuthorContributionDataV1(T:Tables,sessionId:string,includeCardStyle:boolean,
  projection?:AuthorContributionProjectionV1):AuthorContributionDataV1 {
  const specKey=keyOf(sessionId,'spec'),rules=T.rules.get(specKey),status=T.status.get(specKey)
  const cards=branchRows(T.cards,sessionId),worldbook=branchRows(T.worldbook,sessionId)
  const cardRefs=cards.map(([key,value])=>rowRef('cards',key,value))
  const loreRefs=worldbook.map(([key,value])=>rowRef('worldbook',key,value))
  const rulesRef=rowRef('rules',specKey,rules),statusRef=rowRef('status',specKey,status)
  const cardsMembershipSha256=recordSha256(Object.fromEntries(cardRefs.map(ref=>[ref.key,ref.sha256])))
  const worldbookMembershipSha256=recordSha256(Object.fromEntries(loreRefs.map(ref=>[ref.key,ref.sha256])))
  const excluded=new Map<string,string>()
  if(projection) {
    if(projection.schemaVersion!==1||projection.authority!=='consumer-data-only'
      ||projection.rulesRowSha256!==rulesRef.sha256||projection.beforeCoreSha256!==sha256(text(rules?.core))
      ||projection.worldbookMembershipSha256!==worldbookMembershipSha256)fail('AUTHOR_CONTRIBUTION_SOURCE_CHANGED')
    for(const ref of projection.suppressAlwaysOn) {
      const entry=worldbook.find(([key])=>key===ref.key)
      if(excluded.has(ref.key)||!entry||entry[1]?.enabled===false||entry[1]?.alwaysOn!==true
        ||recordSha256(entry[1])!==ref.sha256)fail('AUTHOR_CONTRIBUTION_ALWAYS_ON_UNPROVEN')
      excluded.set(ref.key,ref.sha256)
    }
  }
  const parts:AuthorContributionPartV1[]=[]
  const add=(kind:AuthorContributionPartV1['kind'],identity:string,row:AuthorContributionRowV1|null,
    field:string|null,originalText:string,rendered:string)=>{
    const part={kind,identity,row,field,originalText,originalTextSha256:sha256(originalText),
      text:rendered,textSha256:sha256(rendered)}
    parts.push(part);return part
  }
  for(const [key,value] of cards)if(value) {
    const single={cards:{get:()=>value,entries:()=>[[key,value]] as [string,AuthorRecord][]}}
    add('card',`cards:${key}`,rowRef('cards',key,value),'content',text(value.content),renderCards(single,sessionId))
  }
  const core=projection?projection.residualCore:rules?.core?String(rules.core):''
  if(core)add('core',`rules:${specKey}/core`,rulesRef,'core',text(rules?.core),'【核心设定·固定世界基础】\n'+core)
  const pinned=worldbook.filter(([key,value])=>value&&value.enabled!==false&&value.alwaysOn===true&&!excluded.has(key))
  const pinnedParts=pinned.map(([key,value])=>add('always-on',`worldbook:${key}`,rowRef('worldbook',key,value),
    'content',text(value.content),renderWorldbookEntry(value)))
  if(rules?.plot)add('plot',`rules:${specKey}/plot`,rulesRef,'plot',text(rules.plot),
    '【剧情指引·尚未发生的作者路线】\n以下目标、触发条件和结局仅是可能性；只有所选分支已发生的事件能满足条件。不能把路线写成既成事实，不能替玩家选择路线。\n'+rules.plot)
  if(includeCardStyle&&rules?.narrative)add('narrative',`rules:${specKey}/narrative`,rulesRef,'narrative',text(rules.narrative),'【叙事规则】\n'+rules.narrative)
  if(includeCardStyle&&rules?.reply)add('reply',`rules:${specKey}/reply`,rulesRef,'reply',text(rules.reply),'【回复规则】\n'+rules.reply)
  if(includeCardStyle&&rules?.style)add('examples',`rules:${specKey}/style`,rulesRef,'style',text(rules.style),
    '【文风特化·作者要求与完整样本】\n模仿叙述方式、节奏与语言质感；示例不是当前剧情，不代表事件已经发生，不搬用样本中的人物与事件。\n'+rules.style)
  add('worldbook-query','owned:passive-worldbook-query',null,null,'',projection?.nativeLoreReadPolicy==='automatic'
    ?'【本轮世界书】程序已经按本轮消息、启用条件和预算提供生效条目。未提供的条目不构成本轮设定；不要请求作者源码或把旧检索结果当作永久上下文。'
    :'【世界书查询】世界书是被动资料库，不是常驻背景。根据导演笔记和当前问题，用 rp_worldbook_search 的明确关键词查阅；不要把旧检索结果当作永久上下文。')
  const statusRules=statusAuthorRules(status?.text)
  if(statusRules)add('status',`status:${specKey}/text`,statusRef,'text',text(status?.text),
    '【状态规则·创作参考】（状态栏是叙事展示，不构成原生数值状态权威；本轮存在 native-mvu-state 完整锚点时，数值基准与更新格式以该锚点为准。状态栏及行动建议由程序在正文落盘后交给维护任务生成；主代理不生成面板或调用 rp_status_set。）\n'+statusRules)
  const ruleParts:string[]=[]
  for(const part of parts) {
    if(part.kind==='card')continue
    if(part.kind==='always-on') {
      if(part===pinnedParts[0])ruleParts.push('【核心设定·旧卡常驻标记兼容投影】\n以下原文由旧constant/always_on标记明确指定为常驻，按核心设定保留；其余世界书条目只按本轮查询读取。\n'+pinnedParts.map(item=>item.text).join('\n\n'))
    }else if(part.kind!=='examples'||!projection?.splitExamples)ruleParts.push(part.text)
  }
  const body={schemaVersion:1 as const,encoding:'roleplay-author-field-contributions-v1' as const,
    authority:'consumer-data-only' as const,sessionId,includeCardStyle,
    cardsText:parts.filter(part=>part.kind==='card').map(part=>part.text).join('\n\n'),
    rulesText:ruleParts.join('\n\n'),examplesText:projection?.splitExamples
      ?parts.filter(part=>part.kind==='examples').map(part=>part.text).join('\n\n'):'',parts,
    residentParts:[{section:'roleplay:cards',name:'roleplay:cards',text:renderCards(T,sessionId)},
      {section:'roleplay:rules',name:'roleplay:rules / 核心设定',text:projection?projection.residualCore:text(rules?.core)},
      {section:'roleplay:rules',name:'roleplay:rules / 剧情指引',text:text(rules?.plot)},
      ...pinnedParts.map((part,index)=>({section:'roleplay:rules',name:`roleplay:rules / 常驻世界书 ${index+1}`,text:part.text}))]
      .filter(part=>!!part.text),
    rows:[...cardRefs,...loreRefs,rulesRef,statusRef],cardsMembershipSha256,worldbookMembershipSha256}
  return freeze({...body,dataSha256:recordSha256(body)})
}
