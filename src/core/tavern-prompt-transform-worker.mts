import {parentPort,workerData} from 'node:worker_threads'
import {executeTavernPromptTransformsV1} from './tavern-prompt-transform-execution.mjs'
import type {MessagePort} from 'node:worker_threads'
import type {TavernPromptTransformWorkerInputV1,TavernPromptTransformResultV1,TavernPromptTransformWorkerResultV1,
  TavernPromptTransformWorkerCompletionV1} from './tavern-prompt-transform-types.mjs'

function processBatch(data:TavernPromptTransformWorkerInputV1):TavernPromptTransformWorkerResultV1 {
  try {
    const result=executeTavernPromptTransformsV1(data)
    // Transport packing follows canonical receipt/hash construction. The three
    // originals remain owned by the bounded caller's admitted batch input.
    return data.projectionTransport==='input-backed'&&result.kind==='transformed'
      ?{kind:'transformed',output:{...result.output,entries:result.output.entries.map(
        ({rawText:_rawText,storyText:_storyText,inputText:_inputText,...projection})=>projection)},
        ...(result.displayProvenance?{displayProvenance:result.displayProvenance}:{})}
      :result
  }catch {
    const diagnostic={schemaVersion:1 as const,
      code:'PROMPT_TRANSFORM_WORKER',entryKey:null,ruleId:null,macro:null,limit:null}
    return {kind:'refused',diagnostics:[diagnostic]} satisfies TavernPromptTransformResultV1
  }
}

// The Host may import this module while loading its published worker entries.
if(parentPort) {
  const startup=workerData as TavernPromptTransformWorkerInputV1|{completionPort:MessagePort}|null
  if(startup&&'completionPort' in startup) {
    const {completionPort}=startup
    // Ready workers reuse trusted imports. Each batch owns its compiled rules,
    // macro state and display provenance.
    parentPort.on('message',(data:TavernPromptTransformWorkerInputV1)=>{
      const result=processBatch(data)
      completionPort.postMessage({completedAt:performance.now(),result} satisfies TavernPromptTransformWorkerCompletionV1)
    })
    parentPort.postMessage({kind:'ready'})
  }else parentPort.postMessage(processBatch(startup as TavernPromptTransformWorkerInputV1))
}
