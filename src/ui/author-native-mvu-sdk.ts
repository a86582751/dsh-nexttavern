import type {AuthorNativeSnapshotDataV1} from '../core/author-native-helper-types.js'
import type {MvuPlayerEditExpected,MvuMessageTargetV1} from '../core/roleplay-mvu-player-types.js'
import type {MvuJsonObject} from '../core/tavern-mvu-initvar.js'

export interface AuthorNativeMvuWriteV1 {
  readonly values:MvuJsonObject
  readonly expected:MvuPlayerEditExpected
  readonly target?:MvuMessageTargetV1
}
interface MvuReadBasis {
  readonly readScope:string
  readonly numerical:AuthorNativeSnapshotDataV1['numerical']
  readonly variables:Readonly<Record<string,unknown>>
}

/** Serialized into both native realms. A cloned MVU DTO keeps the last
 * explicit read for its actual target; display broadcasts never promote it.
 * Numerical writes preserve the read-only MVU envelope around stat_data. */
export function createAuthorNativeMvuApi(options:{
  snapshot():AuthorNativeSnapshotDataV1
  readScope():string
  variables(options:unknown):unknown
  replace(value:AuthorNativeMvuWriteV1,readScope:string):Promise<{ok:boolean;code?:string}>
}) {
  const retained=new WeakMap<object,MvuReadBasis>(),reads=new Map<string,MvuReadBasis>()
  let messageReadKey:string|undefined
  const available=(scope:any)=>scope?.kind==='available'?scope.variables:{}
  function selection(input:any={type:'chat'}) {
    const snapshot=options.snapshot(),type=input.type??'chat'
    if(type==='chat') {
      const variables={...available(snapshot.scopeFrame.scopes.chat),...snapshot.ordinaryChat.values}
      for(const key of snapshot.ordinaryChat.deletedKeys??[])delete variables[key]
      return {key:'chat',scope:'chat' as const,variables,target:undefined}
    }
    if(type!=='message')throw Error('AUTHOR_NATIVE_MVU_REPLACEMENT_UNSUPPORTED')
    const id=input.message_id,rows=snapshot.messages,
      row=id===undefined||id==='latest'?rows.at(-1)
        :rows[id<0?rows.length+id:id]
    if(!row)throw Error('AUTHOR_NATIVE_MVU_MESSAGE_UNAVAILABLE')
    const target:MvuMessageTargetV1|undefined=row.nativeSeq===null?undefined:{kind:'message',
      ownerSessionId:row.ownerSessionId,nativeSeq:row.nativeSeq,messageId:row.messageId,
      messageVersionSha256:row.messageVersionSha256}
    return {key:JSON.stringify([row.ownerSessionId,row.nativeSeq,row.messageId,row.messageVersionSha256]),
      scope:'message' as const,variables:available(row.variables),target}
  }
  function read(input:any={type:'chat'}) {
    if(input.type&&input.type!=='chat'&&input.type!=='message')return options.variables(input)
    const selected=selection(input),data=structuredClone(selected.variables),
      basis:MvuReadBasis={readScope:options.readScope(),numerical:options.snapshot().numerical,
        variables:selected.variables}
    const numerical=basis.numerical,carrier=numerical.kind==='ready'||numerical.kind==='schema-ready'
      ?numerical.currentMessageCarrier:undefined
    if(selected.scope==='chat'||selected.target&&same(selected.target,carrier)) {
      // Historical messages are readable but have no write target. Retain only
      // chat and the owner's current message basis, not one snapshot per turn.
      if(selected.scope==='message') {
        if(messageReadKey&&messageReadKey!==selected.key)reads.delete(messageReadKey)
        messageReadKey=selected.key
      }
      reads.set(selected.key,basis)
    }
    retained.set(data,basis)
    return data
  }
  const same=(left:unknown,right:unknown):boolean=>{
    if(left===right)return true
    if(!left||!right||typeof left!=='object'||typeof right!=='object')return false
    if(Array.isArray(left)!==Array.isArray(right))return false
    const keys=Object.keys(left),other=right as Record<string,unknown>
    return keys.length===Object.keys(other).length&&keys.every(key=>Object.hasOwn(other,key)
      &&same((left as Record<string,unknown>)[key],other[key]))
  }
  const api={events:{COMMAND_PARSED:'mag_command_parsed',VARIABLE_UPDATE_ENDED:'mag_variable_update_ended',
    BEFORE_MESSAGE_UPDATE:'mag_before_message_update'},
    getMvuData:read,
    async replaceMvuData(data:any,input:any={type:'chat'}):Promise<void> {
      const selected=selection(input)
      if(selected.scope==='message'&&!selected.target)throw Error('AUTHOR_NATIVE_MVU_MESSAGE_UNAVAILABLE')
      const basis=retained.get(data)??reads.get(selected.key)??{
        readScope:options.readScope(),numerical:options.snapshot().numerical,
        variables:selected.variables}
      // A normal round-trip includes initialization metadata. It may accompany
      // the replacement unchanged; only stat_data belongs to this writer.
      for(const key of Object.keys(data))if(key!=='stat_data'&&!same(data[key],basis.variables[key]))
        throw Error('AUTHOR_NATIVE_MVU_REPLACEMENT_UNSUPPORTED')
      if(basis.numerical.kind!=='ready'&&basis.numerical.kind!=='schema-ready')
        throw Error('AUTHOR_NATIVE_MVU_NOT_READY')
      const result=await options.replace({values:data.stat_data,expected:basis.numerical.expected,
        ...selected.target?{target:selected.target}:{}},basis.readScope)
      if(!result.ok)throw Error(result.code??'AUTHOR_NATIVE_MVU_REPLACEMENT_REFUSED')
    }}
  return api
}
