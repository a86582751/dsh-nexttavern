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
