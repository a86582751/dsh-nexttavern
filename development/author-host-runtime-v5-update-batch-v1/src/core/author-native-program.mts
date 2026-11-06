/** Source-owned native helper bytes and execution layout. This capture neither
 * classifies JavaScript nor grants a live realm permission to call a writer. */
import {recordSha256} from './roleplay-data.js'
import type {MvuSchemaCompilationInputV4} from './tavern-mvu-author-execution-types-v4.mjs'

export type AuthorNativeProgramSourceV1=Readonly<Omit<MvuSchemaCompilationInputV4['source'],'material'>>&{
  readonly sourceRecordSessionId:string
}

export interface AuthorNativeRealmV1 {
  readonly realmId:string
  readonly groupId:string
}

/** Core supplies actual helper membership from Source metadata. Ordinals refer
 * to the complete original descriptor list, including other execution roles. */
export interface AuthorNativeRealmSelectionV1 extends AuthorNativeRealmV1 {
  readonly originalOrdinals:readonly number[]
}

export interface AuthorNativeProgramInputV1 {
  readonly source:MvuSchemaCompilationInputV4['source']
  readonly sourceRecordSessionId:string
  readonly scripts:MvuSchemaCompilationInputV4['scripts']
  readonly realms:readonly AuthorNativeRealmSelectionV1[]
}

/** Product SDK policy selected by the actual permission-group owner and frozen
 * with opening Source. It is not a claim discovered in author import text. */
export interface AuthorNativeLayoutV1 {
  readonly realms:readonly AuthorNativeRealmSelectionV1[]
  readonly numericalProfile:'native-mvu-state-v1'|null
}

export interface AuthorNativeScriptV1 {
  readonly scriptId?:string
  readonly name?:string
  readonly button?:{readonly enabled:boolean;readonly buttons:readonly {readonly name:string;readonly visible:boolean}[]}
  readonly originalOrdinal:number
  /** Execution placement only. Shared-realm code can call another script's
   * functions, so this is never evidence of an asynchronous caller's identity. */
  readonly realmId:string
  readonly identity:string
  readonly pointer:string
  readonly enabled:boolean
  readonly javascript:string
  readonly sourceSha256:string
  readonly descriptorSha256:string
}

export interface AuthorNativeProgramV1 {
  readonly schemaVersion:1
  readonly encoding:'author-native-program-v1'
  readonly authority:'captured-source-data-only'
  readonly source:AuthorNativeProgramSourceV1
  readonly realms:readonly AuthorNativeRealmV1[]
  /** Original Source order. Consumers skip disabled rows without renumbering. */
  readonly scripts:readonly AuthorNativeScriptV1[]
  readonly programSha256:string
}

/** The complete Original owns code digests. This program's identity seals its
 * Source membership/layout using those pins, without reserializing source JS. */
export function authorNativeProgramSha256V1(program:Omit<AuthorNativeProgramV1,'programSha256'>):string {
  const scripts=program.scripts.map(({javascript:_javascript,...pin})=>pin)
  return recordSha256({...program,scripts})
}

/** The caller owns checked Original DATA and live Source/Session/Stop currency.
 * This synchronous projection consumes schemaOriginalCompilationInput(original)
 * directly; it does not require a Browser program or executable Host artifact. */
export function captureAuthorNativeProgramV1(input:AuthorNativeProgramInputV1):AuthorNativeProgramV1 {
  const membership=new Map<number,string>()
  const realms=input.realms.map(({realmId,groupId,originalOrdinals})=>{
    for(const ordinal of originalOrdinals){
      membership.set(ordinal,realmId)
    }
    return {realmId,groupId}
  })
  const scripts:AuthorNativeScriptV1[]=[]
  for(const [originalOrdinal,descriptor] of input.scripts.entries()){
    const realmId=membership.get(originalOrdinal)
    if(realmId===undefined)continue
    // Raw author metadata belongs to the same captured Source card. The code
    // descriptor intentionally carries only executable bytes/import pins.
    let raw:unknown=input.source.material.card
    for(const encoded of descriptor.pointer.split('/').slice(1)){
      const key=encoded.replace(/~1/g,'/').replace(/~0/g,'~')
      raw=raw&&typeof raw==='object'?(raw as Record<string,unknown>)[key]:undefined
    }
    const data=raw&&typeof raw==='object'?raw as Record<string,unknown>:undefined
    const button=data?.button as {enabled?:boolean;buttons?:{name:string;visible:boolean}[]}|undefined
    const buttons=button?.buttons?.filter(row=>typeof row.name==='string')
      .map(row=>({name:row.name,visible:row.visible===true}))??[]
    scripts.push({originalOrdinal,realmId,identity:descriptor.identity,pointer:descriptor.pointer,
      enabled:descriptor.enabled,javascript:descriptor.source,sourceSha256:descriptor.sourceSha256,
      descriptorSha256:recordSha256(descriptor),scriptId:typeof data?.id==='string'?data.id:descriptor.identity,
      ...typeof data?.name==='string'?{name:data.name}:{},
      ...button?{button:{enabled:button.enabled!==false,buttons}}:{}})
  }
  const {ownerSessionId,importId,sourceSha256,importRecordSha256,sourceSnapshotSha256,materialSha256}=input.source
  const source={ownerSessionId,importId,sourceSha256,importRecordSha256,sourceSnapshotSha256,materialSha256,
    sourceRecordSessionId:input.sourceRecordSessionId}
  const body={schemaVersion:1 as const,encoding:'author-native-program-v1' as const,
    authority:'captured-source-data-only' as const,source,realms,scripts}
  // Source already owns code/material digests. Hash each selected raw descriptor
  // once, then seal the layout with those pins rather than serializing JS again.
  return {...body,programSha256:authorNativeProgramSha256V1(body)}
}
