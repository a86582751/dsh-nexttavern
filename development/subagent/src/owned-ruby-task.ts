/** Ruby's declared input is durable DATA. The independent live owner remains
 * with Core/TaskHost and is never serialized into the child descriptor. */
import type {NativeInputAdmissionHookV2,NativePreparationReceiptV1,NativeRequestMaterialTransformV1}
  from '@deepseek-ai/dsh-agent-loop'

export interface OwnedRubyTaskMessageV1 {
  readonly role:'system'|'user'|'assistant'
  readonly text:string
}
export interface OwnedRubyTaskActivationV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-ruby-task-v1'
  readonly taskId:string
  readonly generation:string
  readonly promptPlanSha256:string
  /** The one independent child input; Native allocates the output identity. */
  readonly userMessageId:string
  readonly orderedMessages:readonly OwnedRubyTaskMessageV1[]
  /** Index of the one inserted Native input, distinct from optional user items. */
  readonly mainInputMessageIndex?:number
}
export interface OwnedRubyTaskOwnerV1 {
  readonly preparation:NativePreparationReceiptV1
  readonly snapshot:NativeRequestMaterialTransformV1['snapshot']
  readonly plan:NativeRequestMaterialTransformV1['plan']
  readonly captureSha256:string
  /** Checks the actual live parent task, Source and cancellation currency.
   * Native's own child system/user/header appends do not revoke this owner. */
  assertCurrent():void
  readonly checkpoint:NativeInputAdmissionHookV2['checkpoint']
  readonly completedWork:NonNullable<NativeInputAdmissionHookV2['completedWork']>
  readonly onStop:NonNullable<NativeInputAdmissionHookV2['onStop']>
  readonly onBlocked?:NativeInputAdmissionHookV2['onBlocked']
}

/** Persistence/start boundary for the ordered Ruby transport. Later
 * setup consumes these captured primitives without another shape parser. */
export function readOwnedRubyTaskActivationV1(value:unknown):OwnedRubyTaskActivationV1 {
  if(!value||typeof value!=='object')throw Error('RUBY_ACTIVATION_INVALID')
  const row=value as Record<string,unknown>
  if(row.schemaVersion!==1||row.encoding!=='owned-ruby-task-v1'
    ||['taskId','generation','promptPlanSha256','userMessageId'].some(key=>
      typeof row[key]!=='string'||!(row[key] as string).length)
    ||!Array.isArray(row.orderedMessages)||row.orderedMessages.length<1)
    throw Error('RUBY_ACTIVATION_INVALID')
  const orderedMessages=row.orderedMessages.map((message:unknown)=>{
    const entry=message as OwnedRubyTaskMessageV1|null
    if(!entry||!['system','user','assistant'].includes(entry.role)||typeof entry.text!=='string')
      throw Error('RUBY_ACTIVATION_ORDER_INVALID')
    return Object.freeze({role:entry.role,text:entry.text})
  })
  // Old v1 DATA predates the explicit index and is unambiguous only with one
  // user role. Preserve that shape rather than rewriting its stored hashes.
  const indexed=Object.hasOwn(row,'mainInputMessageIndex')
  if(indexed) {
    const index=row.mainInputMessageIndex
    if(typeof index!=='number'||!Number.isSafeInteger(index)||index<0||index>=orderedMessages.length
      ||orderedMessages[index]!.role!=='user')throw Error('RUBY_ACTIVATION_ORDER_INVALID')
  }else if(orderedMessages.filter(message=>message.role==='user').length!==1)
    throw Error('RUBY_ACTIVATION_ORDER_INVALID')
  return Object.freeze({schemaVersion:1,encoding:'owned-ruby-task-v1',
    taskId:row.taskId as string,generation:row.generation as string,
    promptPlanSha256:row.promptPlanSha256 as string,userMessageId:row.userMessageId as string,
    orderedMessages:Object.freeze(orderedMessages),
    ...(indexed?{mainInputMessageIndex:row.mainInputMessageIndex as number}:{})})
}
