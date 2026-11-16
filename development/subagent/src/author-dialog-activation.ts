/** Frozen auxiliary DATA and its separately admitted process-local Native owner. */
import type {Context} from '@deepseek-ai/cordis'
import type {NativeAuthorGenerationPlanV1,NativeAuthorGenerationOwnerV1} from 'dsh-nexttavern-native-agent-loop'
export interface OwnedAuthorDialogActivationV1 extends NativeAuthorGenerationPlanV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-author-dialog-v1'
}
export function readOwnedAuthorDialogActivationV1(value:unknown):OwnedAuthorDialogActivationV1 {
  const row=value as OwnedAuthorDialogActivationV1|undefined
  if(!row||row.schemaVersion!==1||row.encoding!=='owned-author-dialog-v1'
    ||row.identity?.kind!=='author-generation'||!row.identity.childSessionId||!row.identity.messageId
    ||!Array.isArray(row.orderedMessages)||!row.call||!row.material)throw Error('invalid owned author generation activation')
  return row
}
export function composeOwnedAuthorDialogActivationV1(ctx:Context,_activation:OwnedAuthorDialogActivationV1):()=>void {
  return ctx.systemPrompt.suppressRuntimeContext()
}
export interface OwnedAuthorDialogProgrammaticDriverV1 {
  generateAuthorDialogAssistant?(input:{plan:NativeAuthorGenerationPlanV1;owner:NativeAuthorGenerationOwnerV1}):Promise<
    {kind:'committed';turn:number;messageId:string}|{kind:'busy'}|{kind:'unknown';reason:string}>
}
export async function driveOwnedAuthorDialogActivationV1(child:OwnedAuthorDialogProgrammaticDriverV1,
  activation:OwnedAuthorDialogActivationV1,owner:NativeAuthorGenerationOwnerV1):Promise<void> {
  if(typeof child.generateAuthorDialogAssistant!=='function')throw Error('owned author generation Native driver unavailable')
  const result=await child.generateAuthorDialogAssistant({plan:activation,owner})
  if(result.kind!=='committed')throw Error('owned author generation '+result.kind)
}
