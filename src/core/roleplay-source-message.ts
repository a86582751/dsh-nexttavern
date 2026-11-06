/** The Source owner captures rules and macros once for an actual write.
 * Native stores the raw stream and the resulting canonical message together;
 * historical readers never invoke this processor with today's rules. */
import {applyTavernPromptTransformsV1,tavernPromptRegexAppliesToChannelV1} from './tavern-prompt-transform.mjs'
import {nativeInputSha256} from 'dsh-nexttavern-native-agent-loop'
import type {ContentBlock} from 'dsh-nexttavern-native-llm'
import type {UserSourceOperation,UserSourceOperationInput} from '../../compat/session-controller/src/types.js'
import type {TavernPromptMacroSnapshotV1,TavernPromptRegexRuleV1,
  TavernPromptTransformInputV1,TavernPromptProjectionV1,TavernPromptTransformOutputV1}
  from './tavern-prompt-transform-types.mjs'

export const ROLEPLAY_SOURCE_MESSAGE_POLICY_V1=Object.freeze({schemaVersion:1,
  encoding:'nexttavern-source-message-policy-v1',authority:'consumer-data-only',
  upstreamCommit:'06bde939fb1e9c4c8d8641d810f0a916b5bce127',
  channel:'source',pipeline:'regex-only',depth:'absent-at-source-write',
  responseOrder:'transport-recovery-normalize-source-regex-native-append-MVU',
  history:'persisted-result-only; no-reexecution-on-read-fork-or-current-rule-change',
  requests:{normal:0,retry:0,fallback:0}})

export interface RoleplaySourceMessageCaptureV1 {
  readonly schemaVersion:1
  readonly encoding:'nexttavern-source-message-capture-v1'
  readonly authority:'consumer-data-only'
  readonly sourceSnapshotSha256:string
  readonly placement:1|2
  readonly isEdit:boolean
  readonly depth:null
  readonly pipeline:'regex-only'
  readonly rules:readonly TavernPromptRegexRuleV1[]
  readonly macros:TavernPromptMacroSnapshotV1
  readonly scriptOrder?:TavernPromptTransformInputV1['scriptOrder']
}

/** Keep only scripts that this Source write can execute. Display/prompt-only
 * catalogs and disabled rules do not make a Source write launch a Worker. */
export function roleplaySourceMessageRulesV1(rules:readonly TavernPromptRegexRuleV1[],
  placement:1|2,isEdit=false):readonly TavernPromptRegexRuleV1[] {
  return rules.filter(rule=>rule.allowed&&!rule.disabled&&rule.findRegex
    &&rule.placement.includes(placement)&&(!isEdit||rule.runOnEdit)
    &&tavernPromptRegexAppliesToChannelV1(rule,'source'))
}

export function createRoleplaySourceMessageProcessorV1(capture:RoleplaySourceMessageCaptureV1) {
  const entry=(text:string,key:string,sourcePointer:string):TavernPromptTransformInputV1['entries'][number]=>({
    key,bookId:null,entryId:null,sourcePointer,sourceSnapshotSha256:capture.sourceSnapshotSha256,
    rawText:text,storyText:text,inputText:text,pipeline:capture.pipeline,channel:'source',placement:capture.placement,
    depth:capture.depth,isEdit:capture.isEdit,characterOverride:null,required:true})
  async function execute(entries:TavernPromptTransformInputV1['entries'],signal:AbortSignal,assertCurrent:()=>void) {
    const result=await applyTavernPromptTransformsV1({schemaVersion:1,
      encoding:'owned-tavern-prompt-transform-v1',authority:'consumer-data-only',
      sourceSnapshotSha256:capture.sourceSnapshotSha256,regexDisabled:false,
      macros:capture.macros,rules:capture.rules,
      ...capture.scriptOrder?{scriptOrder:capture.scriptOrder}:{},
      entries},{signal,assertCurrent})
    if(result.kind!=='transformed')throw Error(result.diagnostics[0]?.code??'SOURCE_MESSAGE_TRANSFORM_REFUSED')
    return result.output
  }
  function receipt(projection:TavernPromptProjectionV1,totals:TavernPromptTransformOutputV1['totals']) {
    // The actual input and final text already belong to Native's response
    // material. Preserve the transform facts without four more prose copies.
    const {rawText:_raw,storyText:_story,inputText:_input,outputText,
      schemaVersion:_version,encoding:_encoding,authority:_authority,projectionSha256,...facts}=projection
    return {text:outputText,producerReceipt:{schemaVersion:1,
      encoding:'nexttavern-source-message-receipt-v1',authority:'consumer-data-only',
      ...facts,fullProjectionSha256:projectionSha256,totals}}
  }
  return {capture,async finalize(text:string,signal:AbortSignal,assertCurrent:()=>void) {
    const output=await execute([entry(text,'source-message','/native/source-message')],signal,assertCurrent)
    return receipt(output.entries[0]!,output.totals)
  },async finalizeBlocks(content:readonly ContentBlock[],signal:AbortSignal,assertCurrent:()=>void) {
    signal.throwIfAborted();assertCurrent()
    const entries=content.flatMap((block,blockIndex)=>block.type==='text'
      ?[entry(block.text,`source-message-${blockIndex}`,`/native/source-message/content/${blockIndex}`)]:[]),
      output=entries.length?await execute(entries,signal,assertCurrent):undefined,
      blocks:{blockIndex:number;receipt:ReturnType<typeof receipt>['producerReceipt']}[]=[]
    let textIndex=0
    const result=content.map((block,blockIndex)=>{
      if(block.type!=='text')return block
      const transformed=receipt(output!.entries[textIndex++]!,output!.totals)
      blocks.push({blockIndex,receipt:transformed.producerReceipt})
      return {...block,text:transformed.text}
    })
    return {content:result,producerReceipt:{schemaVersion:1,encoding:'nexttavern-source-message-blocks-receipt-v1',
      authority:'consumer-data-only',policy:ROLEPLAY_SOURCE_MESSAGE_POLICY_V1,
      capture:{sourceSnapshotSha256:capture.sourceSnapshotSha256,placement:capture.placement,isEdit:capture.isEdit,
        depth:capture.depth,pipeline:capture.pipeline,...capture.scriptOrder?{scriptOrder:capture.scriptOrder}:{}},
      blocks,totals:output?.totals??null}}
  }}
}

/** One real Controller invocation retains Source's FIFO until its final
 * Native publication and flush. The actual Source reader owns currency. */
export function createRoleplayUserSourceOperationV1(deps:{
  withSourceLock<T>(work:()=>Promise<T>,signal:AbortSignal):Promise<T>
  capture(input:UserSourceOperationInput):{
    processor?:ReturnType<typeof createRoleplaySourceMessageProcessorV1>
    assertCurrent():void
    release?():void
  }
  assertOwnerCurrent():void
}):UserSourceOperation {
  return {async admit(input,publish) {
    await deps.withSourceLock(async()=>{
      input.signal.throwIfAborted();deps.assertOwnerCurrent()
      if(input.alreadyAccepted?.()){await publish({content:input.content});return}
      const read=deps.capture(input),assertCurrent=()=>{
        input.signal.throwIfAborted();deps.assertOwnerCurrent();read.assertCurrent()
      }
      try {
        assertCurrent()
        const result=read.processor?await read.processor.finalizeBlocks(input.content,input.signal,assertCurrent):undefined
        assertCurrent()
        await publish(result?{content:result.content,material:{schemaVersion:1,encoding:'native-message-source-material-v1',
          rawSource:input.content,effectiveContentSha256:nativeInputSha256(result.content),producerReceipt:result.producerReceipt}}
          :{content:input.content})
      }finally {read.release?.()}
    },input.signal)
  }}
}
