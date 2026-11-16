/** One auxiliary Native request. Serialized identity never restores its live owner. */
import type {AssistantMessage,FinishReason,RequestMessage,RequestLocalSamplingV1,ToolSchema}
  from 'dsh-nexttavern-native-llm'
import type {NativeMaterialDataRefV1,NativeRequestMaterialRecordV3} from 'dsh-nexttavern-native-session'
import type {AuthorGenerationTerminalV1} from 'dsh-nexttavern-session-format'
import type {SessionEvent} from 'dsh-nexttavern-native-session'
import type {SessionMessageProjection} from 'dsh-nexttavern-native-session/surface'
import {nativeInputSha256} from './input-admission.js'
import {reconstructNativeRequestMaterialV1} from './request-material.js'

export type NativeAuthorGenerationIdentityV1=NativeRequestMaterialRecordV3['owner']
export type NativeAuthorGenerationTerminalV1=AuthorGenerationTerminalV1
export interface NativeAuthorGenerationPlanV1 {
  readonly identity:NativeAuthorGenerationIdentityV1
  readonly orderedMessages:readonly RequestMessage[]
  readonly call:RequestLocalSamplingV1&{readonly tools?:readonly ToolSchema[]}
  readonly material:{readonly snapshot:NativeMaterialDataRefV1;readonly plan:NativeMaterialDataRefV1;readonly captureSha256:string}
}
export interface NativeAuthorGenerationCheckpointV1 {
  readonly identity:NativeAuthorGenerationIdentityV1
  readonly headerRef:{readonly seq:number;readonly sha256:string}
  readonly materialRef:{readonly seq:number;readonly sha256:string}
  readonly turn:number
  readonly step:number
  readonly signal:AbortSignal
  current():boolean
}
export interface NativeAuthorGenerationCompletionV1 {
  readonly identity:NativeAuthorGenerationIdentityV1
  readonly materialRef:{readonly seq:number;readonly sha256:string}
  readonly assistantRef:{readonly seq:number;readonly sha256:string}
  readonly turnEndRef:{readonly seq:number;readonly sha256:string}
  readonly message:AssistantMessage
  readonly finishReason:FinishReason
}
export interface NativeAuthorGenerationStreamV1 {
  readonly identity:NativeAuthorGenerationIdentityV1
  readonly kind:'text'|'reasoning'
  readonly delta:string
}
export interface NativeAuthorGenerationOwnerV1 {
  current():boolean
  checkpoint(input:NativeAuthorGenerationCheckpointV1):Promise<void>
  closing(input:NativeAuthorGenerationCompletionV1,signal:AbortSignal):Promise<void>
  terminal(input:NativeAuthorGenerationTerminalV1,signal:AbortSignal):Promise<void>
  stream?(input:NativeAuthorGenerationStreamV1):void
}
export function inspectNativeAuthorGenerationTerminalV1(identity:NativeAuthorGenerationIdentityV1,
  events:readonly SessionEvent[]):NativeAuthorGenerationTerminalV1|undefined {
  const material=events.find(event=>event.type==='request/material'&&event.data.schemaVersion===3
    &&nativeInputSha256(event.data.owner)===nativeInputSha256(identity))
  if(material?.type!=='request/material')return undefined
  const end=events.find(event=>event.type==='turn/end'&&event.data.turn===material.data.turn&&event.seq>material.seq)
  if(end?.type!=='turn/end'||!['completed','max-tokens','error','aborted','blocked'].includes(end.data.reason.kind))return undefined
  return {identity,turnEndRef:{seq:Number(end.seq),sha256:nativeInputSha256(end)},turn:end.data.turn,reason:end.data.reason}
}
export function inspectNativeAuthorGenerationV1(identity:NativeAuthorGenerationIdentityV1,
  events:readonly SessionEvent[],projections:readonly SessionMessageProjection[]):NativeAuthorGenerationCompletionV1|undefined {
  const material=events.find(event=>event.type==='request/material'&&event.data.schemaVersion===3
    &&nativeInputSha256(event.data.owner)===nativeInputSha256(identity)),
    assistant=events.find(event=>event.type==='assistant/message'&&event.data.message.id===identity.messageId)
  if(material?.type!=='request/material'||assistant?.type!=='assistant/message')return
  const end=events.find(event=>event.type==='turn/end'&&event.data.turn===assistant.data.turn)
  if(end?.type!=='turn/end'||!['completed','max-tokens'].includes(end.data.reason.kind))return
  reconstructNativeRequestMaterialV1({materialEvent:material,events,projections,expectedHeaderSha256:material.data.header.sha256})
  const finish=assistant.data.stream?.findLast(record=>record.type==='chunk'&&record.chunk.type==='finish')
  if(finish?.type!=='chunk'||finish.chunk.type!=='finish')return
  return {identity,materialRef:{seq:material.seq,sha256:nativeInputSha256(material)},
    assistantRef:{seq:assistant.seq,sha256:nativeInputSha256(assistant)},turnEndRef:{seq:end.seq,sha256:nativeInputSha256(end)},
    message:assistant.data.message,finishReason:finish.chunk.reason}
}
