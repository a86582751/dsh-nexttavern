/** One formal GENERATE loader activation pass over actual ordered Source
 * bucket references. Rendering, random lifetime and publication stay owned by
 * the preparation; this selector neither reads history nor executes bodies. */
import {LoreEvaluationRefusal} from './tavern-lore-match.mjs'
import type {TavernLoreBoundedMatcherV1} from './tavern-lore-match.mjs'
import type {TavernSourceRenderCatalogEntryV1} from './tavern-source-render-catalog.mjs'
import type {TavernLoreFrozenSettingsV1} from './tavern-lore-evaluator-types.mjs'

type Entry=TavernSourceRenderCatalogEntryV1
type KeyKind='primaryKeys'|'secondaryKeys'
export interface TavernGenerateLoaderSelectorDependenciesV1 {
  readonly matcher:Pick<TavernLoreBoundedMatcherV1,'matches'>
  readonly settings:Pick<TavernLoreFrozenSettingsV1,'caseSensitive'|'matchWholeWords'|'useGroupScoring'>
  projectKey(row:Entry,kind:KeyKind,index:number,raw:string):string|Promise<string>
  drawRange(lower:number,upper:number):number
  assertCurrent():void
  readonly signal:AbortSignal
}
export type TavernGenerateLoaderSelectionV1=
  |{readonly kind:'selected';readonly entries:readonly Entry[]}
  |{readonly kind:'refused';readonly code:string;readonly entryId:string;readonly sourcePointer:string}

class SelectionRefusal extends Error {
  constructor(readonly row:Entry,code:string){super(code)}
}

export function createTavernGenerateLoaderSelectorV1(deps:TavernGenerateLoaderSelectorDependenciesV1) {
  const current=()=>{deps.signal.throwIfAborted();deps.assertCurrent()}
  async function select(candidates:readonly Entry[],trigger:string):Promise<TavernGenerateLoaderSelectionV1> {
    current()
    const matches=async(row:Entry,kind:KeyKind,project:boolean)=>{
      let keys=row.semantic[kind]
      if(project){
        const rendered:string[]=[]
        for(const [index,raw] of keys.entries()){
          const projected=deps.projectKey(row,kind,index,raw)
          if(typeof projected==='string')rendered.push(projected)
          else {rendered.push(await projected);current()}
        }
        keys=rendered
      }
      try {
        const result=await deps.matcher.matches(trigger,keys,
          row.semantic.caseSensitive??deps.settings.caseSensitive,
          row.semantic.matchWholeWords??deps.settings.matchWholeWords)
        current();return result
      }catch(error){
        if(error instanceof LoreEvaluationRefusal)throw new SelectionRefusal(row,error.code)
        throw error
      }
    }
    const score=async(row:Entry)=>{
      if(!row.semantic.primaryKeys.length)return 0
      // Fixed group scoring consumes raw keys, not the admission macro result.
      const primary=await matches(row,'primaryKeys',false),logic=row.semantic.selectiveLogic,
        base=primary.filter(Boolean).length
      if(!row.semantic.secondaryKeys.length||logic!=='and-any'&&logic!=='and-all')return base
      const secondary=await matches(row,'secondaryKeys',false)
      return base+(logic==='and-any'||secondary.every(Boolean)?secondary.filter(Boolean).length:0)
    }
    try {
      const activated:Entry[]=[]
      for(const row of candidates){
        const {semantic,formal}=row
        if(!formal.enabled||semantic.vectorized)continue
        if(semantic.useProbability&&semantic.probability<deps.drawRange(1,100))continue
        if(formal.directives.some(directive=>directive.args!==''&&(directive.name==='@@activate'
          ||directive.name==='@@dont_activate'||directive.name==='@@only_preload')))
          throw new SelectionRefusal(row,'GENERATE_LOADER_ACTIVATION_ARGUMENTS_UNSUPPORTED')
        if(semantic.constant||formal.names.includes('@@activate')){activated.push(row);continue}
        if(formal.names.includes('@@dont_activate')||formal.names.includes('@@only_preload'))continue
        const primary=await matches(row,'primaryKeys',true)
        if(!primary.some(Boolean))continue
        if(semantic.selective&&semantic.secondaryKeys.length){
          const secondary=await matches(row,'secondaryKeys',true),any=secondary.some(Boolean),all=secondary.every(Boolean),
            logic=semantic.selectiveLogic
          if(!(logic==='and-any'?any:logic==='and-all'?all:logic==='not-all'?!all:!any))continue
        }
        activated.push(row)
      }
      const ungrouped:Entry[]=[],groups:Record<string,Entry[]>=Object.create(null)
      for(const row of activated){
        const name=row.semantic.group
        if(name===''){ungrouped.push(row);continue}
        const bucket=groups[name]??=[]
        bucket.push(row)
      }
      const winners:Entry[]=[]
      // Object key iteration matches fixed groupBy, including integer group
      // names. Each group's members retain the actual input candidate order.
      for(const rows of Object.values(groups)){
        if(rows.length===1){winners.push(rows[0]!);continue}
        if(rows.some(row=>row.semantic.groupOverride)){
          const top=Math.min(...rows.map(row=>row.semantic.order))
          if(top){winners.push(rows.find(row=>row.semantic.order<=top)!);continue}
        }
        if(rows.some(row=>row.semantic.useGroupScoring??deps.settings.useGroupScoring)){
          const scores:number[]=[]
          for(const row of rows)scores.push(await score(row))
          const top=Math.max(...scores)
          if(top){winners.push(rows[scores.findIndex(value=>value>=top)]!);continue}
        }
        if(rows.some(row=>!row.semantic.groupOverride&&!row.semantic.useGroupScoring)){
          let roll=deps.drawRange(1,rows.reduce((total,row)=>total+row.semantic.groupWeight,0))
          for(const row of rows){
            roll-=row.semantic.groupWeight
            if(roll<=0){winners.push(row);break}
          }
        }
      }
      return {kind:'selected',entries:ungrouped.concat(winners)}
    }catch(error){
      if(error instanceof SelectionRefusal)return {kind:'refused',code:error.message,
        entryId:error.row.entry.entryId,sourcePointer:error.row.resolved.pointer}
      throw error
    }
  }
  return {select}
}
