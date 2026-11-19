/** Build a new portable author document from already-owned, frozen DATA.
 * The original Session keeps execution records and full history. */
import type {NextTavernCardData,NextTavernCardDocument,NextTavernAuthorRow} from './nexttavern-card.js'
import type {TavernNativeFinalLoreTextV1} from './roleplay-tavern-layout.js'
import type {TavernPublishedAuthorProseV1} from './roleplay-tavern-prompt-types.js'

export interface TextOnlyStoryMessageV1 {
  readonly seq:number
  readonly turn:number
  readonly role:'user'|'assistant'
  readonly text:string
}
export interface TextOnlyPublishedSettingsV1 {
  readonly authorGroups:readonly {id:string;text:string}[]
  readonly cardProse?:TavernPublishedAuthorProseV1
  readonly finalLore:readonly TavernNativeFinalLoreTextV1[]
}

export function projectTextOnlyContinuationSourceV1(input:{
  readonly current:NextTavernCardData
  readonly literalText?:true
  readonly published?:TextOnlyPublishedSettingsV1
  readonly history:readonly TextOnlyStoryMessageV1[]
  readonly provenance:Readonly<Record<string,unknown>>
}) {
  const omitted:{unit:string;reason:string}[]=[],cards:NextTavernAuthorRow[]=[],worldbook:NextTavernAuthorRow[]=[],
    name=input.published?'纯文字续玩':input.current.name
  // A template is one executable resource. Keeping only selected substrings
  // would change its semantics and could turn a previously inert token active.
  const retain=(unit:string,text:string,target:NextTavernAuthorRow[],name:string,metadata:Record<string,unknown>={})=>{
    if(!text.trim())return
    if(!input.published&&!input.literalText&&text.includes('<%')){omitted.push({unit,reason:'unmaterialized-template'});return}
    target.push({...metadata,name,content:text,enabled:true})
  }
  const staticMetadata=(row:Readonly<Record<string,unknown>>)=>({
    ...structuredClone(Object.fromEntries(['kind','aliases','keywords','triggers','priority','tokenBudget','alwaysOn']
      .filter(field=>Object.hasOwn(row,field)).map(field=>[field,row[field]]))),
  })
  if(input.published) {
    const prose=input.published.cardProse
    if(prose?.schemaVersion!==1||prose.encoding!=='native-published-author-prose-v1')
      throw Error('TEXT_ONLY_PUBLISHED_AUTHOR_PROSE_UNAVAILABLE')
    const retained=new Set<string>(prose.units.map(unit=>unit.source.kind==='author-group'
      ?unit.source.id:`community-${unit.source.marker}`))
    retain('/published/cards',prose.units.filter(unit=>unit.kind!=='user'&&unit.text.trim()).map(unit=>unit.text).join('\n\n'),cards,name)
    retain('/published/persona',prose.units.filter(unit=>unit.kind==='user'&&unit.text.trim()).map(unit=>unit.text).join('\n\n'),cards,'玩家',{kind:'user'})
    for(const group of input.published.authorGroups) {
      if(!retained.has(group.id)&&group.text.trim())omitted.push({unit:group.id,reason:'advanced-or-instruction-material'})
    }
    for(const row of input.published.finalLore)retain(row.entryId,row.text,worldbook,row.entryId,{alwaysOn:true})
  }else {
    input.current.cards.forEach((row,index)=>{
      if(row.enabled!==false)retain(`/data/cards/${index}`,row.content,cards,row.name??input.current.name,staticMetadata(row))
    })
    input.current.worldbook.forEach((row,index)=>{
      if(row.enabled!==false)retain(`/data/worldbook/${index}`,row.content,worldbook,row.name??`资料 ${index+1}`,staticMetadata(row))
    })
    const rawEntries=input.current.character_book?.entries
    for(const [id,row] of Object.entries(rawEntries??{})) {
      if(row.enabled===false||row.disable===true)continue
      if(typeof row.content==='string')retain(`/data/character_book/entries/${id}`,row.content,worldbook,
        typeof row.comment==='string'?row.comment:id,staticMetadata({...row,content:row.content,
          ...row.keys!==undefined||row.key!==undefined?{keywords:row.keys??row.key}:{},
          ...row.token_budget!==undefined?{tokenBudget:row.token_budget}:{},
          ...row.constant!==undefined?{alwaysOn:row.constant===true}:{}}))
    }
    for(const [field,value] of Object.entries(input.current.rules)) {
      if(typeof value==='string'?value.trim():value&&Object.values(value).some(Boolean))
        omitted.push({unit:`/data/rules/${field}`,reason:'advanced-or-instruction-material'})
    }
  }
  if(input.current.settings)omitted.push({unit:'/data/settings',reason:'extension-settings'})
  if(input.current.extensions)omitted.push({unit:'/data/extensions',reason:'extension-settings'})
  if(input.current.status?.text)omitted.push({unit:'/data/status',reason:'advanced-status'})
  const rawOpening=input.current.opening?.text??''
  if(input.history.length===0&&rawOpening.trim())
    omitted.push({unit:'/data/opening',reason:rawOpening.includes('<%')?'unmaterialized-template':'unconfirmed-opening'})
  const document:NextTavernCardDocument={spec:'nexttavern_card',spec_version:'1.2',
    data:{name,cards,worldbook,rules:{}},
    archive:{textOnlyContinuation:{schemaVersion:1,encoding:'text-only-continuation-source-v1',
      ...input.provenance,omitted}}}
  return {document,omittedCount:omitted.length,retainedCards:cards.length,retainedWorldbook:worldbook.length}
}
