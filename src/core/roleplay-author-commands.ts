/** The bounded command language only coordinates existing owners. User text is
 * published once by Native; a trigger never creates another user message. */
import {AuthorNativeCommandParseError,parseAuthorNativeCommands} from './author-native-commands.js'
import type {NativePublishedUserInputResultV1,NativePublishedInputReceiptV1,
  NativePublishedTriggerResultV1,NativePublishedTriggerReceiptV1} from 'dsh-nexttavern-native-agent-loop/published-input'

export interface AuthorNativeCommandRequestV1 {
  readonly operationId:string
  readonly command:string
}
export type AuthorNativeCommandStepV1=
  |{readonly index:number;readonly kind:'send';readonly receipt:NativePublishedInputReceiptV1}
  |{readonly index:number;readonly kind:'trigger';readonly receipt:NativePublishedTriggerReceiptV1;
    readonly state:'accepted'|'started'|'completed'}
export type AuthorNativeCommandResultV1={readonly operationId:string;readonly pipe:string;
  readonly steps:readonly AuthorNativeCommandStepV1[];
  readonly diagnostic?:{readonly commandIndex:number;readonly offset:number}}&(
  |{readonly kind:'executed'}
  |{readonly kind:'refused'|'unknown';readonly code:string})
export type AuthorNativeTriggerOutcomeV1={readonly result:NativePublishedTriggerResultV1;
  readonly completion?:'completed'|'unknown';readonly code?:string}

export interface AuthorNativeCommandOwnersV1 {
  publish(operationId:string,text:string):Promise<NativePublishedUserInputResultV1>
  trigger(operationId:string,awaitCompletion:boolean):Promise<AuthorNativeTriggerOutcomeV1>
  assertCurrent():void
}

export async function executeAuthorNativeCommands(request:AuthorNativeCommandRequestV1,
  owners:AuthorNativeCommandOwnersV1,signal:AbortSignal):Promise<AuthorNativeCommandResultV1> {
  if(typeof request.operationId!=='string'||!request.operationId)throw Error('AUTHOR_NATIVE_COMMAND_OPERATION_REQUIRED')
  // Parsing the entire chain precedes any effect. Pipe replacement is data,
  // never a second parser invocation that could introduce another command.
  const steps:AuthorNativeCommandStepV1[]=[],pipe=''
  const result={operationId:request.operationId,pipe,steps}
  let commands:ReturnType<typeof parseAuthorNativeCommands>['commands']
  try {commands=parseAuthorNativeCommands(request.command).commands}
  catch(error) {
    if(!(error instanceof AuthorNativeCommandParseError))throw error
    return {...result,kind:'refused',code:error.code,
      diagnostic:{commandIndex:error.commandIndex,offset:error.offset}}
  }
  for(const command of commands) {
    signal.throwIfAborted();owners.assertCurrent()
    const operationId=request.operationId+':'+command.index
    if(command.kind==='send') {
      const text=command.text.replaceAll('{{pipe}}',pipe).trim()
      if(!text)return {...result,kind:'refused',code:'AUTHOR_NATIVE_SEND_EMPTY'}
      const published=await owners.publish(operationId,text)
      if(published.kind!=='published')return {...result,kind:published.kind==='unknown'?'unknown':'refused',code:published.code}
      steps.push({index:command.index,kind:'send',receipt:published.receipt})
    }else {
      const outcome=await owners.trigger(operationId,command.awaitCompletion),triggered=outcome.result
      if(triggered.kind!=='triggered')return {...result,kind:triggered.kind==='unknown'?'unknown':'refused',code:triggered.code}
      const started=['started','latched','running'].includes(triggered.wake.kind)
      steps.push({index:command.index,kind:'trigger',receipt:triggered.receipt,
        state:outcome.completion==='completed'?'completed':started?'started':'accepted'})
      if(outcome.completion!=='completed'&&!started)
        return {...result,kind:'refused',code:outcome.code??'AUTHOR_NATIVE_TRIGGER_NOT_STARTED'}
      if(command.awaitCompletion&&outcome.completion!=='completed')
        return {...result,kind:'unknown',code:outcome.code??'AUTHOR_NATIVE_STORY_NOT_COMPLETED'}
    }
  }
  return {...result,kind:'executed'}
}
