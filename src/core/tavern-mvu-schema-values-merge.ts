/** Merges a computed candidate with one registration's parsed values.
 * The operation owner supplies actual mutation facts and trusted JSON DATA. */
import type {MvuJsonObject} from './tavern-mvu-initvar.js'

export type MvuSchemaMutationEffectV1=
  |{readonly kind:'replace-root'}
  |{readonly kind:'remove-member';readonly parent:readonly string[];readonly collection:'object';readonly key:string}
  |{readonly kind:'remove-member';readonly parent:readonly string[];readonly collection:'array';readonly index:number}
  |null

/** Deletion follows the final candidate, including later array insertions.
 * Only the top-level result changes here, so nested values can be shared. */
export function mergeMvuSchemaValues(before:MvuJsonObject,candidate:MvuJsonObject,
  parsed:MvuJsonObject,effects:readonly MvuSchemaMutationEffectV1[]):MvuJsonObject {
  const basis=effects.some(effect=>effect?.kind==='replace-root')?candidate:before
  const merged={...basis}
  for(const effect of effects) {
    if(effect?.kind!=='remove-member')continue
    const topRoot=(effect.parent[0]??(effect.collection==='object'?effect.key:undefined))!
    if(Object.hasOwn(parsed,topRoot))continue
    if(Object.hasOwn(candidate,topRoot))merged[topRoot]=candidate[topRoot]!
    else delete merged[topRoot]
  }
  for(const name of Object.keys(parsed))merged[name]=parsed[name]!
  return merged
}
