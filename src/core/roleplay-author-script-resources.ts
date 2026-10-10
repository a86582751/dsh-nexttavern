/** Resource DATA comes from an already captured immutable Source frame.
 * This index neither captures Source nor grants a live Browser attachment. */
import type {MvuJsonObject,MvuJsonValue} from './tavern-mvu-initvar.js'

export type AuthorScriptResourceOperationV1=
  |{readonly kind:'self-script-data'}
  |{readonly kind:'explicit-script-data';readonly scriptId:string}
  |{readonly kind:'script-id'}
  |{readonly kind:'script-trees';readonly scope:'global'|'preset'|'character'}
export interface AuthorScriptResourceRequestV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-script-resource-request-v1'
  readonly scriptIdentity:string
  readonly descriptorSha256:string
  readonly sourceSnapshotSha256:string
  readonly operation:AuthorScriptResourceOperationV1
}
/** Existing checked execution-plan pins refer to the code projection, including
 * its imports. They do not pretend to hash the raw descriptor's resource DATA. */
export interface AuthorScriptResourceDescriptorV1 {
  readonly originalOrdinal:number
  readonly identity:string
  readonly pointer:string
  readonly rawDescriptorSha256:string
}
export interface AuthorScriptResourceReaderV1 {
  readonly schemaVersion:1
  readonly encoding:'native-author-script-resource-reader-v1'
  readonly sourceSnapshotSha256:string
  readonly documentSha256:string
  read(request:AuthorScriptResourceRequestV1):MvuJsonValue
}
/** Complete immutable Source capture fields actually consumed by this DATA
 * index. Live ownership stays with the Source factory and Core caller. */
export interface AuthorScriptResourceSourceV1 {
  readonly material:MvuJsonObject
  readonly snapshotSha256:string
  readonly snapshot:{readonly documentSha256:string}
}

const emptyData:MvuJsonObject=Object.freeze({})
const object=(value:MvuJsonValue|undefined):MvuJsonObject|undefined=>
  value!==null&&typeof value==='object'&&!Array.isArray(value)?value:undefined
function fail(code:string):never {throw Error(code)}
function atPointer(card:MvuJsonValue,pointer:string):MvuJsonValue|undefined {
  let value:MvuJsonValue|undefined=card
  for(const encoded of pointer.split('/').slice(1)) {
    const key=encoded.replace(/~1/g,'/').replace(/~0/g,'~')
    if(Array.isArray(value))value=value[Number(key)]
    else value=object(value)?.[key]
  }
  return value
}

/** The Source owner supplies its valid frame and checked plan. Returning their
 * frozen values preserves complete DATA without another clone, hash or parser.
 * Core owns live attachment revocation when that Source frame ceases to apply. */
export function createAuthorScriptResourceReaderV1(frame:AuthorScriptResourceSourceV1,
  descriptors:readonly AuthorScriptResourceDescriptorV1[]):AuthorScriptResourceReaderV1 {
  const card=object(frame.material.card)!,data=object(card.data)??card,
    helper=object(object(data.extensions)?.tavern_helper)!,trees=helper.scripts as MvuJsonValue[]
  const byId=new Map<string,MvuJsonObject>()
  function index(trees:readonly MvuJsonValue[]):void {
    for(const value of trees) {
      const node=object(value)!
      if(node.type==='folder')index(node.scripts as MvuJsonValue[])
      else if(node.type==='script'&&typeof node.id==='string')byId.set(node.id,node)
    }
  }
  index(trees)
  const callers=new Map(descriptors.map(pin=>{
    const descriptor=object(atPointer(card,pin.pointer))
    if(!descriptor)fail('AUTHOR_SCRIPT_RESOURCE_DESCRIPTOR_UNAVAILABLE')
    // Only a descriptor without an original ID receives its existing legacy
    // identity alias. A synthetic alias must not replace a real author UUID.
    const id=typeof descriptor.id==='string'?descriptor.id:pin.identity
    if(typeof descriptor.id!=='string')byId.set(id,descriptor)
    return [pin.identity,{descriptor,pin,id}] as const
  }))
  function read(request:AuthorScriptResourceRequestV1):MvuJsonValue {
    if(request.schemaVersion!==1||request.encoding!=='native-author-script-resource-request-v1') {
      fail('AUTHOR_SCRIPT_RESOURCE_REQUEST_UNSUPPORTED')
    }
    const caller=callers.get(request.scriptIdentity)
    if(request.sourceSnapshotSha256!==frame.snapshotSha256
      ||!caller||request.descriptorSha256!==caller.pin.rawDescriptorSha256) {
      fail('AUTHOR_SCRIPT_RESOURCE_CALLER_CHANGED')
    }
    switch(request.operation.kind) {
      case 'self-script-data':return caller.descriptor.data??emptyData
      case 'explicit-script-data':return byId.get(request.operation.scriptId)?.data??emptyData
      case 'script-id':return caller.id
      case 'script-trees':
        if(request.operation.scope!=='character')fail('AUTHOR_SCRIPT_RESOURCE_SCOPE_UNAVAILABLE')
        return trees
      default:return fail('AUTHOR_SCRIPT_RESOURCE_REQUEST_UNSUPPORTED')
    }
  }
  return Object.freeze({schemaVersion:1,encoding:'native-author-script-resource-reader-v1',
    sourceSnapshotSha256:frame.snapshotSha256,documentSha256:frame.snapshot.documentSha256,read})
}
