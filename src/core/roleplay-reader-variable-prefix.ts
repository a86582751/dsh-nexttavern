/** Reader-only derived DATA. Canonical selection and publications remain with
 * their existing owners; this index stores contributions, never full prefixes. */
import type {ReaderMessageVariableTargetV1} from './reader-regex-document-types.mjs'
import type {MvuJsonObject} from './tavern-mvu-initvar.js'
import type {MvuScopeReadFrameV1} from './tavern-mvu-scope-read-types.js'

export function readerVariableBase(scopes:MvuScopeReadFrameV1['scopes'],
  ordinary:{readonly values:Readonly<MvuJsonObject>;readonly deletedKeys?:readonly string[]}):MvuJsonObject {
  const values=(scope:MvuScopeReadFrameV1['scopes']['chat'])=>scope.kind==='available'?scope.variables:{}
  const result={...values(scopes.global),...values(scopes.character),...values(scopes.chat),...ordinary.values}
  for(const key of ordinary.deletedKeys??[])delete result[key]
  return result
}

export interface ReaderVariableContribution {
  readonly target:ReaderMessageVariableTargetV1
  readonly variables:MvuJsonObject
}
type Position=(seq:number)=>number|undefined
export function createReaderVariablePrefix() {
  const rows=new Map<number,ReaderVariableContribution>(),keys=new Map<string,number[]>()
  let position:Position=()=>undefined
  function remove(seq:number):void {
    const previous=rows.get(seq)
    if(!previous)return
    for(const key of Object.keys(previous.variables)) {
      const contributors=keys.get(key)!,at=position(seq)
      let index:number
      if(at===undefined)index=contributors.indexOf(seq)
      else {
        let low=0,high=contributors.length
        while(low<high){const mid=(low+high)>>>1;if(position(contributors[mid]!)!<at)low=mid+1;else high=mid}
        index=low
      }
      contributors.splice(index,1)
      if(!contributors.length)keys.delete(key)
    }
    rows.delete(seq)
  }
  function put(row:ReaderVariableContribution):void {
    const seq=row.target.nativeSeq,at=position(seq)!
    rows.set(seq,row)
    for(const key of Object.keys(row.variables)) {
      let contributors=keys.get(key)
      if(!contributors){contributors=[];keys.set(key,contributors)}
      let low=0,high=contributors.length
      while(low<high){const mid=(low+high)>>>1;if(position(contributors[mid]!)!<at)low=mid+1;else high=mid}
      contributors.splice(low,0,seq)
    }
  }
  return {
    reset(values:Iterable<ReaderVariableContribution>,nextPosition:Position) {
      rows.clear();keys.clear();position=nextPosition
      for(const row of values)put(row)
    },
    apply(changes:readonly {seq:number;row?:ReaderVariableContribution}[],nextPosition:Position) {
      position=nextPosition
      // Retire old page/version fields before adding their replacements. A
      // missing field reveals an earlier contribution; it is not a tombstone.
      // A removed selection no longer has a current position. Retire those
      // rows first so the remaining ordered lists can use the owner's ranks.
      for(const change of changes)if(position(change.seq)===undefined)remove(change.seq)
      for(const change of changes)if(position(change.seq)!==undefined)remove(change.seq)
      for(const change of changes)if(change.row)put(change.row)
    },
    read(target:ReaderMessageVariableTargetV1,base:Readonly<MvuJsonObject>):MvuJsonObject {
      const actual=rows.get(target.nativeSeq)?.target
      if(!actual||actual.ownerSessionId!==target.ownerSessionId||actual.messageId!==target.messageId
        ||actual.messageVersionSha256!==target.messageVersionSha256||actual.selectedVariant!==target.selectedVariant)
        throw Error('READER_VARIABLE_TARGET_UNAVAILABLE')
      const through=position(target.nativeSeq)!,result={...base}
      for(const [key,contributors] of keys) {
        let low=0,high=contributors.length
        while(low<high){const mid=(low+high)>>>1;if(position(contributors[mid]!)!<=through)low=mid+1;else high=mid}
        if(low)result[key]=rows.get(contributors[low-1]!)!.variables[key]!
      }
      return result
    },
  }
}
