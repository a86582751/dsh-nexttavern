/** Browser-safe edit protocol. A model settlement and its usage are never rewritten. */
import type {Message,MessageSourceMaterialV1} from 'dsh-nexttavern-native-llm/types'
import type {SessionEvent, SessionSeq} from 'dsh-nexttavern-native-session/types'
import {deriveEventMessage, type SessionMessageProjection} from 'dsh-nexttavern-native-session/surface'
import {deepFreeze} from '@deepseek-ai/dsh-util-values'

export const MESSAGE_EDIT_EVENT = 'roleplay/message-edit'

export interface ReaderMessageEditOriginV1 {
  principal:'reader-regex-document'
  sourceRecordSessionId:string
  importId:string
  rawSha256:string
  descriptorSha256:string
  htmlSha256:string
  htmlSpan:{start:number;end:number}
  carrier:{seq:number;messageId:string}
}
export interface MessageEditOperationV1 {
  schemaVersion:1
  encoding:'native-author-message-edit-operation-v1'
  operationId:string
  requestSha256:string
  expectedMessageVersionSha256:string
  origin:{sourceRecordSessionId:string;importId:string;rawSha256:string;realmId:string;groupId:string}
    |ReaderMessageEditOriginV1
}

export interface MessageEditV1 {
  schemaVersion: 1
  targetSeq: SessionSeq
  messageId: string
  role: 'assistant' | 'user'
  text: string
  operation?:MessageEditOperationV1
}
export interface MessageEditV2 extends Omit<MessageEditV1,'schemaVersion'> {
  schemaVersion:2
  sourceMaterial:MessageSourceMaterialV1
}
export type MessageEdit=MessageEditV1|MessageEditV2

declare module 'dsh-nexttavern-native-session/types' {
  interface SessionEventMap {
    /** Required durable edit: preserve the original node, identity and non-text blocks. @messageProjection */
    'roleplay/message-edit': MessageEdit
  }
}

/** Reject future versions and malformed records before storage or replay can accept them. */
export function assertMessageEdit(value: unknown): asserts value is MessageEdit {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw Error('Invalid message edit payload')
  const data = value as Record<string, unknown>
  const material=data['sourceMaterial'] as MessageSourceMaterialV1|undefined,version2=data.schemaVersion===2
  const fields=Object.keys(data).filter(key=>key!=='operation').sort().join(',')
  if (fields !== (version2?'messageId,role,schemaVersion,sourceMaterial,targetSeq,text'
    :'messageId,role,schemaVersion,targetSeq,text')
    || data.schemaVersion !== 1&&!version2 || !Number.isSafeInteger(data.targetSeq) || Number(data.targetSeq) < 0
    || Object.is(data.targetSeq, -0) || typeof data.messageId !== 'string' || data.messageId.length === 0
    || (data.role !== 'assistant' && data.role !== 'user') || typeof data.text !== 'string'
    || data.text.length > 1_000_000) throw Error('Unsupported or malformed message edit')
  if(Object.hasOwn(data,'operation')) {
    const operation=data.operation as MessageEditOperationV1|undefined,origin=operation?.origin,
      hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),
      name=(value:unknown)=>typeof value==='string'&&value.length>0
    if(!operation||typeof operation!=='object'||Array.isArray(operation)
      ||Object.keys(operation).sort().join(',')!=='encoding,expectedMessageVersionSha256,operationId,origin,requestSha256,schemaVersion'
      ||operation.schemaVersion!==1||operation.encoding!=='native-author-message-edit-operation-v1'
      ||!name(operation.operationId)||!hash(operation.requestSha256)||!hash(operation.expectedMessageVersionSha256)
      ||!origin||typeof origin!=='object'||Array.isArray(origin)
      ||!name(origin.sourceRecordSessionId)||!name(origin.importId)||!hash(origin.rawSha256))
      throw Error('Unsupported or malformed message edit operation')
    if('principal' in origin) {
      const position=(value:unknown)=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0
      if(origin.principal!=='reader-regex-document'
        ||Object.keys(origin).sort().join(',')!=='carrier,descriptorSha256,htmlSha256,htmlSpan,importId,principal,rawSha256,sourceRecordSessionId'
        ||!hash(origin.descriptorSha256)||!hash(origin.htmlSha256)
        ||!origin.htmlSpan||Object.keys(origin.htmlSpan).sort().join(',')!=='end,start'
        ||!position(origin.htmlSpan.start)||!position(origin.htmlSpan.end)||origin.htmlSpan.end<origin.htmlSpan.start
        ||!origin.carrier||Object.keys(origin.carrier).sort().join(',')!=='messageId,seq'
        ||!position(origin.carrier.seq)||!name(origin.carrier.messageId))
        throw Error('Unsupported or malformed Reader message edit origin')
    }else if(Object.keys(origin).sort().join(',')!=='groupId,importId,rawSha256,realmId,sourceRecordSessionId'
      ||!name(origin.realmId)||!name(origin.groupId))throw Error('Unsupported or malformed message edit operation')
  }
  if(version2&&(!material||typeof material!=='object'||Array.isArray(material)
    ||Object.keys(material).sort().join(',')!=='effectiveContentSha256,encoding,producerReceipt,rawSource,schemaVersion'
    ||material.schemaVersion!==1||material.encoding!=='native-message-source-material-v1'
    ||!Array.isArray(material.rawSource)||typeof material.effectiveContentSha256!=='string'
    ||!/^[a-f0-9]{64}$/.test(material.effectiveContentSha256)||!material.producerReceipt
    ||typeof material.producerReceipt!=='object'||Array.isArray(material.producerReceipt))) {
    throw Error('Unsupported or malformed message edit v2 source material')
  }
}

/** Replace prose only; tool calls, reasoning, attachments and source attribution remain intact. */
export function editMessageText(message: Message, edit: MessageEdit): Message {
  if (message.role !== edit.role || message.id !== edit.messageId) throw Error('Message edit identity mismatch')
  if (message.role !== 'assistant' && message.role !== 'user') throw Error('Message is not editable')
  const content: Array<(typeof message.content)[number]> = []
  let inserted = false
  for (const block of message.content) {
    if (block.type !== 'text') content.push(block)
    else if (!inserted) {
      content.push({type: 'text', text: edit.text})
      inserted = true
    }
  }
  if (!inserted) content.unshift({type: 'text', text: edit.text})
  const {sourceMaterial:_previousMaterial,...original}=message
  return deepFreeze({...original,content,...edit.schemaVersion===2?{sourceMaterial:edit.sourceMaterial}:{}})
}

export const messageEditProjection: SessionMessageProjection<'roleplay/message-edit'> = {
  type: MESSAGE_EDIT_EVENT,
  project(event, context) {
    if (event.ignorable) throw Error('Message edits cannot be marked ignorable')
    assertMessageEdit(event.data)
    const edit = event.data
    if (edit.targetSeq >= event.seq || !context.nodes.includes(edit.targetSeq)) {
      throw Error('Message edit must target an earlier current surface node')
    }
    const original = context.eventAt ? context.eventAt(edit.targetSeq) : context.events[edit.targetSeq - context.baseSeq]
    if (original?.seq !== edit.targetSeq
      || (original.type !== 'assistant/message' && original.type !== 'user/message')) {
      throw Error('Message edit target is not a user or assistant message')
    }
    const current = context.messages.get(edit.targetSeq) ?? deriveEventMessage(original)
    if (current === null) throw Error('Message edit target has no derived message')
    // Session keeps the original seq as the presentation and model-history anchor.
    return new Map([[edit.targetSeq, editMessageText(current, edit)]])
  },
}

export function isMessageEdit(event: SessionEvent): event is SessionEvent<'roleplay/message-edit'> {
  return event.type === MESSAGE_EDIT_EVENT
}
