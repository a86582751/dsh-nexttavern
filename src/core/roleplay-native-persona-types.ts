/** Account-owned DATA. Browser snapshots carry this projection, never the file
 * document, unknown Native extensions or the durable operation ledger. */
export interface NativePersonaConnectionV1 {
  readonly type:'character'|'group'
  readonly id:string
}
export interface NativePersonaWireV1 {
  readonly avatar_id:string
  readonly avatar:string
  readonly name:string
  readonly gender?:string
  readonly title:string
  readonly description:string
  readonly position:number
  readonly depth:number
  readonly role:number
  readonly lorebook:string
  readonly connections:readonly NativePersonaConnectionV1[]
  readonly is_default:boolean
}
export interface NativePersonaDataV1 {
  readonly schemaVersion:1
  readonly encoding:'native-account-persona-data-v1'
  readonly revision:number
  readonly dataSha256:string
  readonly selectedId:string|null
  readonly defaultId:string|null
  readonly profiles:readonly NativePersonaWireV1[]
  /** IDs for which the same Native owner can actually serve image bytes. */
  readonly avatarIds:readonly string[]
}
export type NativePersonaMutationV1=
  |{readonly kind:'create';readonly name:string;readonly persona:Partial<NativePersonaWireV1>}
  |{readonly kind:'replace';readonly id:string;readonly persona:Partial<NativePersonaWireV1>}
  |{readonly kind:'select';readonly id:string}
  |{readonly kind:'update-current';readonly values:{readonly name?:string;readonly gender?:string}}
export interface NativePersonaOriginV1 {
  readonly kind:'host-ui'|'author-script'|'legacy'
  readonly sessionId?:string
  readonly scriptIdentity?:string
  readonly programSha256?:string
}
export interface NativePersonaOperationV1 {
  readonly schemaVersion:1
  readonly encoding:'native-account-persona-operation-v1'
  readonly operationId:string
  readonly expectedDataSha256?:string
  readonly origin:NativePersonaOriginV1
  readonly mutation:NativePersonaMutationV1
}
export interface NativePersonaReceiptV1 {
  readonly schemaVersion:1
  readonly encoding:'native-account-persona-receipt-v1'
  readonly operationId:string
  readonly payloadSha256:string
  readonly origin:NativePersonaOriginV1
  readonly revision:number
  readonly dataSha256:string
  readonly changed:boolean
  /** Helper create returns a boolean; replace/select/update return void. */
  readonly result:boolean|null
}
export type NativePersonaMutationResultV1=
  |{readonly schemaVersion:1;readonly kind:'committed';readonly receipt:NativePersonaReceiptV1;
    readonly data:NativePersonaDataV1}
  |{readonly schemaVersion:1;readonly kind:'refused';readonly code:string}

/** A selected imported Native card, located by its actual Source identity. */
export interface NativeBrowserCharacterV1 {
  readonly sourceId:string
  readonly name:string
  readonly avatar?:string
}
