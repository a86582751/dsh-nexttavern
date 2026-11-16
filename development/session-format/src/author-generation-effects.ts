/** Root acceptance and settlement of one actual auxiliary Native material. */
import type {Session,SessionEvent,NativeRequestMaterialRecordV3,NativeOpeningEventRefV1,
  NativeMaterialDataRefV1,TurnEndReason} from 'dsh-nexttavern-native-session'

export const AUTHOR_GENERATION_EFFECTS_EVENT='roleplay/author-generation-effects' as const
export type AuthorGenerationEffectsRefV1=NativeOpeningEventRefV1
export interface AuthorGenerationEffectsProgressV1 {
  readonly acceptedRef:AuthorGenerationEffectsRefV1
  readonly settledRef?:AuthorGenerationEffectsRefV1
}
export interface AuthorGenerationEffectsReceiptV1 extends AuthorGenerationEffectsProgressV1 {
  readonly settledRef:AuthorGenerationEffectsRefV1
}
export interface AuthorGenerationTerminalV1 {
  readonly identity:NativeRequestMaterialRecordV3['owner']
  readonly turnEndRef:AuthorGenerationEffectsRefV1
  readonly turn:number
  readonly reason:TurnEndReason
}
interface Base {
  readonly schemaVersion:1
  readonly encoding:'native-author-generation-effects-v1'
  readonly rootSessionId:string
}
export interface AuthorGenerationEffectsAcceptedV1 extends Base {
  readonly kind:'accepted'
  readonly identity:NativeRequestMaterialRecordV3['owner']
  readonly checkpoint:{readonly headerRef:AuthorGenerationEffectsRefV1;readonly materialRef:AuthorGenerationEffectsRefV1;
    readonly turn:number;readonly step:number}
  readonly snapshotRef:NativeMaterialDataRefV1
  readonly planRef:NativeMaterialDataRefV1
  readonly effects:'source'|'readonly'
}
export interface AuthorGenerationEffectsSettledV1 extends Base {
  readonly kind:'settled'
  readonly acceptedRef:AuthorGenerationEffectsRefV1
}
export interface AuthorGenerationEffectsTerminalV1 extends Base {
  readonly kind:'terminal'
  readonly acceptedRef:AuthorGenerationEffectsRefV1
  readonly terminal:AuthorGenerationTerminalV1
}
export type AuthorGenerationEffectsV1=AuthorGenerationEffectsAcceptedV1|AuthorGenerationEffectsSettledV1
  |AuthorGenerationEffectsTerminalV1
declare module 'dsh-nexttavern-native-session/types' {
  interface SessionEventMap {'roleplay/author-generation-effects':AuthorGenerationEffectsV1}
}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)
const sha=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const id=(value:unknown)=>typeof value==='string'&&value.length>0
const integer=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0
const eventRef=(value:unknown)=>object(value)&&integer(value.seq)&&sha(value.sha256)
const dataRef=(value:unknown)=>object(value)&&id(value.key)&&sha(value.sha256)
const identity=(value:unknown,root:string)=>object(value)&&value.kind==='author-generation'
  &&value.rootSessionId===root&&sha(value.planSha256)
  &&['taskId','generation','operationId','generationId','childSessionId','messageId'].every(key=>id(value[key]))
export function assertAuthorGenerationEffects(value:unknown):asserts value is AuthorGenerationEffectsV1 {
  if(!object(value)||value.schemaVersion!==1||value.encoding!=='native-author-generation-effects-v1'
    ||!id(value.rootSessionId))throw Error('AUTHOR_GENERATION_EFFECTS_INVALID')
  if(value.kind==='accepted') {
    const checkpoint=value.checkpoint
    if(identity(value.identity,value.rootSessionId as string)&&object(checkpoint)
      &&eventRef(checkpoint.headerRef)&&eventRef(checkpoint.materialRef)&&integer(checkpoint.turn)&&integer(checkpoint.step)
      &&dataRef(value.snapshotRef)&&dataRef(value.planRef)&&(value.effects==='source'||value.effects==='readonly'))return
  }else if(value.kind==='settled'&&eventRef(value.acceptedRef))return
  else if(value.kind==='terminal'&&eventRef(value.acceptedRef)) {
    const terminal=value.terminal
    if(object(terminal)&&identity(terminal.identity,value.rootSessionId as string)&&eventRef(terminal.turnEndRef)
      &&integer(terminal.turn)&&object(terminal.reason)
      &&['completed','max-tokens','error','aborted','blocked'].includes(String(terminal.reason.kind)))return
  }
  throw Error('AUTHOR_GENERATION_EFFECTS_INVALID')
}
export function appendAuthorGenerationEffects(session:Session,marker:AuthorGenerationEffectsV1)
  :SessionEvent<typeof AUTHOR_GENERATION_EFFECTS_EVENT> {
  if(marker.rootSessionId!==session.id)throw Error('AUTHOR_GENERATION_EFFECTS_ROOT_CHANGED')
  return session.append(AUTHOR_GENERATION_EFFECTS_EVENT,marker)
}
export const authorGenerationEffectsMarkers=Object.freeze({eventType:AUTHOR_GENERATION_EFFECTS_EVENT,
  append:appendAuthorGenerationEffects,assert:assertAuthorGenerationEffects})
