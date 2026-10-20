import {parentPort,workerData} from 'node:worker_threads'
import {executeTavernPromptTransformsV1} from './tavern-prompt-transform-execution.mjs'
import type {TavernPromptTransformWorkerInputV1,TavernPromptTransformResultV1,TavernPromptTransformWorkerResultV1}
  from './tavern-prompt-transform-types.mjs'

try {
  const data=workerData as TavernPromptTransformWorkerInputV1,result=executeTavernPromptTransformsV1(data)
  // Transport packing follows canonical receipt/hash construction. The three
  // originals remain owned by the bounded caller's admitted batch input.
  const message:TavernPromptTransformWorkerResultV1=data.projectionTransport==='input-backed'&&result.kind==='transformed'
    ?{kind:'transformed',output:{...result.output,entries:result.output.entries.map(
      ({rawText:_rawText,storyText:_storyText,inputText:_inputText,...projection})=>projection)},
      ...(result.displayProvenance?{displayProvenance:result.displayProvenance}:{})}
    :result
  parentPort?.postMessage(message)
}
catch(error) {
  const diagnostic={schemaVersion:1 as const,
    code:'PROMPT_TRANSFORM_WORKER',entryKey:null,ruleId:null,macro:null,limit:null}
  parentPort?.postMessage({kind:'refused',diagnostics:[diagnostic]} satisfies TavernPromptTransformResultV1)
}
