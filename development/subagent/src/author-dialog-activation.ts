/** A private Native start-time activation. Its DTO records declared input;
 * TaskHost and the live parent remain the authorization owners. */
import type {Context} from '@deepseek-ai/cordis'

export interface OwnedAuthorDialogActivationV1 {
  readonly schemaVersion:1
  readonly encoding:'owned-author-dialog-v1'
  readonly taskId:string
  readonly generation:string
  readonly promptPlanSha256:string
  readonly operationId:string
  readonly messageId:string
  /** Existing SystemPrompt aggregation: five frozen host slots joined with
   * two newlines. Programmatic generation appends dynamicSystem once. */
  readonly systemPrefix:string
  readonly dynamicSystem:string
}

export function readOwnedAuthorDialogActivationV1(value:unknown):OwnedAuthorDialogActivationV1 {
  if(!value||typeof value!=='object')throw Error('invalid owned author dialogue activation')
  const record=value as Record<string,unknown>
  if(record.schemaVersion!==1||record.encoding!=='owned-author-dialog-v1'
    ||['taskId','generation','promptPlanSha256','operationId','messageId','dynamicSystem']
      .some(key=>typeof record[key]!=='string'||!(record[key] as string).length)
    ||typeof record.systemPrefix!=='string')throw Error('invalid owned author dialogue activation')
  return value as OwnedAuthorDialogActivationV1
}

/** The returned exact disposers are also Cordis scope effects. Child setup
 * rollback and quiescent handle disposal therefore remove both contributions. */
export function composeOwnedAuthorDialogActivationV1(ctx:Context,activation:OwnedAuthorDialogActivationV1):()=>void {
  const removePrefix=ctx.systemPrompt.section({name:'deployment:persona-prefix',
    order:ctx.systemPrompt.getSectionOrder('DEPLOYMENT_PERSONA_PREFIX'),
    text:activation.systemPrefix,interpolate:false,complete:true})
  let restoreContext:(()=>void)|undefined
  try{restoreContext=ctx.systemPrompt.suppressRuntimeContext()}
  catch(error){removePrefix();throw error}
  return ()=>{restoreContext!();removePrefix()}
}

/** The public Agent interface is supplied by upstream; maintained AgentLoop
 * owns this existing no-user operation. This shim checks capability presence
 * instead of pretending an upstream Agent method exists. */
export interface OwnedAuthorDialogProgrammaticDriverV1 {
  generateProgrammaticAssistant?(input:{operationId:string;messageId:string;instruction:string}):Promise<
    {kind:'committed';turn:number;messageId:string}|{kind:'busy'}|{kind:'unknown';reason:string}>
}
export async function driveOwnedAuthorDialogActivationV1(child:OwnedAuthorDialogProgrammaticDriverV1,
  activation:OwnedAuthorDialogActivationV1):Promise<void> {
  if(typeof child.generateProgrammaticAssistant!=='function')throw Error('owned author dialogue Native driver unavailable')
  const receipt=await child.generateProgrammaticAssistant({operationId:activation.operationId,
    messageId:activation.messageId,instruction:activation.dynamicSystem})
  if(receipt.kind!=='committed')throw Error('owned author dialogue generation '+receipt.kind)
}
