import {recordSha256,sha256} from './roleplay-data.js'
import {sourceLines} from './card-export-projection.js'
import type {NativeCardAdvancedReadV1} from './native-card-advanced.js'
import type {NativeCardConversionSnapshotV1} from './native-card-conversion.js'
import type {CharacterMaterial} from './roleplay-character-private.js'

/** Source owns character-level provenance. Unrelated author edits do not
 * replace another character's material identity, and ordinary story appends
 * reuse the immutable Source snapshot and this completed projection. */
export function createRoleplayCharacterMaterial(deps:{
  capture(id:string):{snapshot:NativeCardConversionSnapshotV1;sourceIdentity:unknown}
  read(id:string):NativeCardAdvancedReadV1
  session(id:string):object|undefined
  bodySources(id:string):{validity:string;sources:readonly {seq:number;key:string}[];materialKeys:readonly string[]}
}) {
  const snapshots=new WeakMap<NativeCardConversionSnapshotV1,
    WeakMap<object,readonly CharacterMaterial[]>>()
  interface BodyState {owner:object;validity:string;bodies:Map<number,string>;keys:Set<string>;
    views:Map<CharacterMaterial,CharacterMaterial>;dirty:boolean}
  const bodies=new Map<string,BodyState>()
  function bodyState(id:string) {
    const owner=deps.session(id)
    if(!owner)throw Error('CHARACTER_SOURCE_SESSION_UNAVAILABLE')
    let state=bodies.get(id)
    if(!state||state.owner!==owner||state.dirty) {
      const current=deps.bodySources(id)
      state={owner,validity:current.validity,bodies:new Map(current.sources.map(row=>[row.seq,row.key])),
        keys:new Set([...current.sources.map(row=>row.key),...current.materialKeys]),views:new Map(),dirty:false}
      bodies.set(id,state)
    }
    return state
  }
  const read=(id:string):readonly CharacterMaterial[]=>{
    const captured=deps.capture(id),advanced=deps.read(id)
    if(advanced.state!=='ready'||!advanced.document)return []
    let views=snapshots.get(captured.snapshot)
    if(!views){views=new WeakMap();snapshots.set(captured.snapshot,views)}
    const cached=views.get(advanced.document)
    if(cached)return withBodies(cached,bodyState(id))
    const {snapshot,sourceIdentity}=captured
    const materials=advanced.document.data.cards.flatMap((row,index):CharacterMaterial[]=>{
      if(row.kind==='user'||row.enabled===false)return []
      const characterId=String(row.characterId??`native-character-${index+1}`)
      const assigned=advanced.classification?.assignments.filter(assignment=>
        assignment.target==='character'&&assignment.characterId===characterId)
      const refs=assigned?.map(assignment=>{
        const unit=snapshot.units.find(unit=>unit.id===assignment.sourceId)!
        const digest=assignment.startLine===1&&assignment.endLine===unit.lineCount?unit.sha256
          :sha256(sourceLines(unit.text).slice(assignment.startLine-1,assignment.endLine).join('\n'))
        return {pointer:unit.pointer,sha256:digest,startLine:assignment.startLine,endLine:assignment.endLine}
      })??snapshot.units.filter(unit=>unit.pointer===`/data/compatibility/authorExecution/cards/${index}/content`)
        .map(unit=>({pointer:unit.pointer,sha256:unit.sha256,startLine:1,endLine:unit.lineCount}))
      const name=row.name??advanced.document!.data.name
      const materialId=recordSha256({sourceIdentity,characterId,name,refs})
      const sourceKeys=refs.map(ref=>`character-source:${recordSha256({sourceIdentity,...ref})}`)
      const dynamic=!advanced.characters.some(character=>character.id===characterId)
      return [{id:characterId,name,identity:materialId,materialId,sourceKeys,authorSourceKeys:sourceKeys,
        authorText:dynamic?'':row.content,...dynamic?{requiresPublishedMaterial:true as const}:{},
        available:!!row.content.trim()}]
    })
    views.set(advanced.document,materials)
    return withBodies(materials,bodyState(id))
  }
  function withBodies(materials:readonly CharacterMaterial[],state:BodyState) {
    return materials.map(row=>{
      let view=state.views.get(row)
      if(!view) {
        view={...row,identity:`${row.identity}:${state.validity}`,sourceKeys:[...row.sourceKeys,...state.keys]}
        state.views.set(row,view)
      }
      return view
    })
  }
  return Object.assign(read,{
    /** Native's durable completion notification is the sole append producer.
     * Replacements invalidate the selected projection instead of reviving rows
     * by adding their formerly invalid source keys to the live membership. */
    accept(id:string,canonical:{seq:number;key:string},materialKey?:string) {
      const state=bodyState(id),prior=state.bodies.get(canonical.seq)
      if(prior&&prior!==canonical.key){state.dirty=true;return}
      state.bodies.set(canonical.seq,canonical.key)
      for(const key of [canonical.key,...materialKey?[materialKey]:[]])if(!state.keys.has(key)) {
        state.keys.add(key)
        for(const view of state.views.values())(view.sourceKeys as string[]).push(key)
      }
    },
    invalidate(id:string) {const state=bodies.get(id);if(state)state.dirty=true},
    release(id:string) {bodies.delete(id)},
  })
}
