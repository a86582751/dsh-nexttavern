/** The bounded command language only coordinates existing owners. User text is
 * published once by Native; a trigger never creates another user message. */
import {AuthorNativeCommandParseError,parseAuthorNativeCommands} from './author-native-commands.js'
import type {AuthorNativeRubyCommand} from './author-native-commands.js'
import type {RubyManualRunReceiptV1} from './roleplay-ruby-owner-types.js'
import type {TavernLoreMutationReceiptV2} from './roleplay-tavern-lore-edits-types.js'
import type {TavernLoreSourceDataV1} from './roleplay-tavern-lore-source-types.js'
import type {RoleplayInputSourceDataWindowV1} from './roleplay-input-preparation.js'
import type {NativePublishedUserInputResultV1,NativePublishedInputReceiptV1,
  NativePublishedTriggerResultV1,NativePublishedTriggerReceiptV1} from 'dsh-nexttavern-native-agent-loop/published-input'

export interface AuthorNativeCommandRequestV1 {
  readonly operationId:string
  readonly command:string
}
/** The actual retained writer supplies these controls. A historical receipt
 * never reconstructs its live Source continuation or generation window. */
export interface AuthorNativeCommandSourceControlsV1 {
  writeCurrent():boolean
  published(source:TavernLoreSourceDataV1):Promise<void>|void
  readonly capturePublication?:()=>ReturnType<RoleplayInputSourceDataWindowV1['begin']>
}
export type AuthorNativeCommandStepV1=
  |{readonly index:number;readonly kind:'send';readonly receipt:NativePublishedInputReceiptV1}
  |{readonly index:number;readonly kind:'trigger';readonly receipt:NativePublishedTriggerReceiptV1;
    readonly state:'accepted'|'started'|'completed'}
  |{readonly index:number;readonly kind:'ruby';readonly action:'read'|'run'|'preset'|'status'|'panel'|'reload';
    readonly receipt?:RubyManualRunReceiptV1|TavernLoreMutationReceiptV2;readonly sourceDataPublished?:true}
export type AuthorNativeCommandResultV1={readonly operationId:string;readonly pipe:string;
  readonly steps:readonly AuthorNativeCommandStepV1[];
  /** A publication callback already adopts Source DATA. Later writers require
   * one final capture. Read/status/panel/reload add no snapshot mutation. */
  readonly refreshRequired?:true;
  readonly diagnostic?:{readonly commandIndex:number;readonly offset:number}}&(
  |{readonly kind:'executed'}
  |{readonly kind:'refused'|'unknown';readonly code:string})
export type AuthorNativeTriggerOutcomeV1={readonly result:NativePublishedTriggerResultV1;
  readonly completion?:'completed'|'unknown';readonly code?:string}
export interface AuthorNativeRubyCommandOutcomeV1 {
  readonly kind:'executed'|'refused'|'unknown'
  readonly pipe?:string
  readonly code?:string
  readonly receipt?:RubyManualRunReceiptV1|TavernLoreMutationReceiptV2
  readonly sourceDataPublished?:true
}

export interface AuthorNativeCommandOwnersV1 {
  publish(operationId:string,text:string):Promise<NativePublishedUserInputResultV1>
  trigger(operationId:string,awaitCompletion:boolean):Promise<AuthorNativeTriggerOutcomeV1>
  ruby?(operationId:string,command:AuthorNativeRubyCommand,signal:AbortSignal):Promise<AuthorNativeRubyCommandOutcomeV1>
  assertCurrent():void
}

export async function executeAuthorNativeCommands(request:AuthorNativeCommandRequestV1,
  owners:AuthorNativeCommandOwnersV1,signal:AbortSignal):Promise<AuthorNativeCommandResultV1> {
  if(typeof request.operationId!=='string'||!request.operationId)throw Error('AUTHOR_NATIVE_COMMAND_OPERATION_REQUIRED')
  // Parsing the entire chain precedes any effect. Pipe replacement is data,
  // never a second parser invocation that could introduce another command.
  const steps:AuthorNativeCommandStepV1[]=[]
  const result:{operationId:string;pipe:string;steps:AuthorNativeCommandStepV1[];refreshRequired?:true}=
    {operationId:request.operationId,pipe:'',steps}
  const substitute=(text:string)=>text.replaceAll('{{pipe}}',()=>result.pipe)
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
      const text=substitute(command.text).trim()
      if(!text)return {...result,kind:'refused',code:'AUTHOR_NATIVE_SEND_EMPTY'}
      const published=await owners.publish(operationId,text)
      if(published.kind!=='published')return {...result,kind:published.kind==='unknown'?'unknown':'refused',code:published.code}
      steps.push({index:command.index,kind:'send',receipt:published.receipt})
      result.refreshRequired=true
    }else if(command.kind==='trigger') {
      const outcome=await owners.trigger(operationId,command.awaitCompletion),triggered=outcome.result
      if(triggered.kind!=='triggered')return {...result,kind:triggered.kind==='unknown'?'unknown':'refused',code:triggered.code}
      const started=['started','latched','running'].includes(triggered.wake.kind)
      steps.push({index:command.index,kind:'trigger',receipt:triggered.receipt,
        state:outcome.completion==='completed'?'completed':started?'started':'accepted'})
      result.refreshRequired=true
      if(outcome.completion!=='completed'&&!started)
        return {...result,kind:'refused',code:outcome.code??'AUTHOR_NATIVE_TRIGGER_NOT_STARTED'}
      if(command.awaitCompletion&&outcome.completion!=='completed')
        return {...result,kind:'unknown',code:outcome.code??'AUTHOR_NATIVE_STORY_NOT_COMPLETED'}
    }else {
      if(!owners.ruby)return {...result,kind:'refused',code:'AUTHOR_NATIVE_RUBY_UNSUPPORTED'}
      let prepared:AuthorNativeRubyCommand,action:Extract<AuthorNativeCommandStepV1,{kind:'ruby'}>['action']
      if(command.kind==='ruby-read') {
        prepared={...command,key:substitute(command.key),book:substitute(command.book)};action='read'
      }else if(command.kind==='ruby-run') {
        prepared={...command,taskSpecs:command.taskSpecs.map(substitute)};action='run'
      }else if(command.kind==='ruby-preset') {
        prepared={...command,selector:substitute(command.selector)};action='preset'
      }else {
        prepared=command
        action=command.kind==='ruby-status'?'status':command.kind==='ruby-panel'?'panel':'reload'
      }
      const outcome=await owners.ruby(operationId,prepared,signal)
      if(outcome.pipe!==undefined)result.pipe=outcome.pipe
      if(outcome.kind==='executed'||outcome.receipt)steps.push({index:command.index,kind:'ruby',action,
        ...(outcome.receipt?{receipt:outcome.receipt}:{}),
        ...(outcome.sourceDataPublished?{sourceDataPublished:true}:{})})
      if(outcome.sourceDataPublished)delete result.refreshRequired
      else if(action==='run'&&outcome.receipt)result.refreshRequired=true
      if(outcome.kind!=='executed')return {...result,kind:outcome.kind,
        code:outcome.code??(outcome.kind==='unknown'?'AUTHOR_NATIVE_RUBY_UNKNOWN':'AUTHOR_NATIVE_RUBY_REFUSED')}
    }
  }
  return {...result,kind:'executed'}
}
