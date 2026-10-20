/** Project only the outputs of one actual Native material preparation. Source
 * membership belongs to the capture/render owner; this module neither renders
 * author code nor turns a catalog entry into an admitted lore contribution. */
import type {NativeCardClassificationTargetV1,NativeCardClassificationV1}
  from './native-card-conversion.js'
import type {TavernNativeFinalLoreTextV1} from './roleplay-tavern-layout.js'

export type NativeCardAdvancedRuleV1=Exclude<NativeCardClassificationTargetV1,'character'|'other'>
export interface NativeCardAdvancedRenderedGroupV1 {
  id:string
  text:string
  /** Complete group membership, derived from the captured author producer's
   * row/field references. null retains an unmapped or program-owned member;
   * dropping that member would falsely assign its output to another source. */
  sourceIds:readonly (string|null)[]
}
export interface NativeCardAdvancedMaterialInputV1 {
  /** Already validated against the same Source snapshot by its owner. */
  classification:NativeCardClassificationV1
  authorGroups:readonly NativeCardAdvancedRenderedGroupV1[]
  finalLore:readonly TavernNativeFinalLoreTextV1[]
  /** Actual compilation entryId to the captured conversion unit. The owner
   * resolves current membership/source pointers, never text similarity. */
  loreSources:ReadonlyMap<string,string>
}
export interface NativeCardAdvancedMaterialCharacterV1 {
  id:string
  name:string
  aliases?:string[]
  persona:string
  /** Only this preparation's admitted, finally rendered lore. A lore-only
   * association does not establish that a persona is available. */
  lore:string
}
export interface NativeCardAdvancedMaterialProjectionV1 {
  characters:NativeCardAdvancedMaterialCharacterV1[]
  rules:Partial<Record<NativeCardAdvancedRuleV1,string>>
  unavailable:{kind:'author'|'lore';id:string;
    reason:'unmapped-source'|'mixed-ownership'|'unassigned'}[]
}
type Destination={target:'character';characterId:string}|{target:NativeCardAdvancedRuleV1}
type Ownership={kind:'assigned';destination:Destination}|{kind:'mixed'}|{kind:'unassigned'}
const same=(left:Destination,right:Destination)=>left.target===right.target
  &&(left.target!=='character'||right.target==='character'&&left.characterId===right.characterId)

export function projectNativeCardAdvancedMaterialV1(
  input:NativeCardAdvancedMaterialInputV1,
):NativeCardAdvancedMaterialProjectionV1 {
  const ownership=new Map<string,Ownership>()
  for(const span of input.classification.assignments) {
    const current:Ownership=span.target==='other'?{kind:'unassigned'}:{kind:'assigned',destination:
      span.target==='character'?{target:'character',characterId:span.characterId!}:{target:span.target}}
    const previous=ownership.get(span.sourceId)
    if(!previous)ownership.set(span.sourceId,current)
    else if(previous.kind!==current.kind||previous.kind==='assigned'&&current.kind==='assigned'
      &&!same(previous.destination,current.destination))ownership.set(span.sourceId,{kind:'mixed'})
  }
  const characters=new Map<string,{persona:string[];lore:string[]}>()
  const ruleParts=new Map<NativeCardAdvancedRuleV1,string[]>()
  const unavailable:NativeCardAdvancedMaterialProjectionV1['unavailable']=[]
  const add=(kind:'author'|'lore',id:string,text:string,sourceIds:readonly (string|null)[])=>{
    if(!text)return
    let destination:Destination|undefined,reason:typeof unavailable[number]['reason']|undefined
    if(!sourceIds.length)reason='unmapped-source'
    for(const sourceId of sourceIds) {
      const source=sourceId===null?undefined:ownership.get(sourceId)
      if(!source){reason='unmapped-source';break}
      if(source.kind==='mixed'){reason='mixed-ownership';break}
      if(source.kind==='unassigned'){reason='unassigned';break}
      if(destination&&!same(destination,source.destination)){reason='mixed-ownership';break}
      destination=source.destination
    }
    if(reason||!destination){unavailable.push({kind,id,reason:reason??'unmapped-source'});return}
    if(destination.target==='character') {
      let material=characters.get(destination.characterId)
      if(!material){material={persona:[],lore:[]};characters.set(destination.characterId,material)}
      material[kind==='author'?'persona':'lore'].push(text)
    }else {
      const parts=ruleParts.get(destination.target)??[]
      parts.push(text);ruleParts.set(destination.target,parts)
    }
  }
  for(const group of input.authorGroups)add('author',group.id,group.text,group.sourceIds)
  for(const entry of input.finalLore)add('lore',entry.entryId,entry.text,[input.loreSources.get(entry.entryId)??null])
  return {characters:input.classification.characters.flatMap(character=>{
    const material=characters.get(character.id)
    return material?[{...character,...character.aliases?{aliases:[...character.aliases]}:{},
      persona:material.persona.join('\n\n'),lore:material.lore.join('\n\n')}]:[]
  }),rules:Object.fromEntries([...ruleParts].map(([target,parts])=>[target,parts.join('\n\n')])),unavailable}
}
