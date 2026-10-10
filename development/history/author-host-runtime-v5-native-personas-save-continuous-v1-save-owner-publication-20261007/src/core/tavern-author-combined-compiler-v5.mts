/** Prompt1 admits complete stateless registrations. Browser2 then owns whole
 * browser descriptors; the actual ABI4 compiler owns the remaining scripts. */
import {recordSha256} from './roleplay-data.js'
import {validateSchemaCompilationInputV4} from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaCompilerV4} from './tavern-mvu-schema-program-v4.js'
import type {BrowserPartitionCompilerV2} from './tavern-author-browser-types-v2.mjs'
import type {BrowserProgramSourceLocatorV1} from './tavern-author-browser-types.mjs'
import type {PromptCompilerV1} from './tavern-author-prompt-types.mjs'
import type {AuthorExecutionPlanV3,CombinedCompilerIdentityV1,CombinedPlanRowV3}
  from './tavern-author-combined-types.mjs'
import type {CombinedAuthorCompilerV5,CombinedAuthorProgramV5,CombinedCompilationV5}
  from './tavern-author-combined-types-v5.mjs'
import {validateCombinedAuthorProgramV5} from './tavern-author-combined-data-v5.mjs'

export function createCombinedAuthorCompilerV5(deps:{
  readonly server:MvuSchemaCompilerV4
  readonly browser:BrowserPartitionCompilerV2
  readonly prompt:PromptCompilerV1
  readonly implementationSha256:string
}):CombinedAuthorCompilerV5 {
  const identity:CombinedCompilerIdentityV1=Object.freeze({id:'native-author-combined-compiler',version:1,hostProtocol:5,
    implementationSha256:recordSha256({implementationSha256:deps.implementationSha256,
      server:deps.server.identity,browser:deps.browser.identity,prompt:{compiler:deps.prompt.identity,runtime:deps.prompt.runtime}})})
  const refused=(code:string):CombinedCompilationV5=>({kind:'refused',diagnostics:[{code}]})
  const compile:CombinedAuthorCompilerV5['compile']=async(input,signal)=>{
    if(signal?.aborted)return refused('COMBINED_COMPILER_CANCELLED')
    if(input.schemaVersion!==5||input.encoding!=='native-author-combined-compilation-input-v5') {
      return refused('COMBINED_COMPILER_INPUT_VERSION')
    }
    let original:CombinedAuthorProgramV5['original']
    try {original=validateSchemaCompilationInputV4(input.original)}
    catch {return refused('COMBINED_ORIGINAL_INPUT_INVALID')}
    const {material:_material,...source}=original.source
    const locator:BrowserProgramSourceLocatorV1={...source,sourceRecordSessionId:input.sourceRecordSessionId}
    const scripts=original.scripts.map((descriptor,ordinal)=>({ordinal,descriptor}))
    let promptProgram:CombinedAuthorProgramV5['promptProgram']=null
    let promptOrdinals:readonly number[]
    try {
      const candidates=await deps.prompt.compileCandidates({schemaVersion:1,
        encoding:'native-author-prompt-compilation-input-v1',source:locator,scripts},signal)
      promptOrdinals=candidates.rows.filter(row=>row.kind==='compiled'&&row.descriptor.enabled).map(row=>row.ordinal)
      if(promptOrdinals.length) {
        const result=deps.prompt.assembleAccepted(candidates,promptOrdinals)
        if(result.kind==='refused')return result
        promptProgram=result.program
      }
    }catch {return refused(signal?.aborted?'COMBINED_COMPILER_CANCELLED':'COMBINED_PROMPT_COMPILATION_FAILED')}
    if(signal?.aborted)return refused('COMBINED_COMPILER_CANCELLED')
    const promptIndices=new Map(promptOrdinals.map((ordinal,index)=>[ordinal,index]))
    const partition=await deps.browser.partition({schemaVersion:2,
      encoding:'native-author-browser-compilation-input-v2',source:locator,
      scripts:scripts.filter(row=>!promptIndices.has(row.ordinal))},signal)
    if(partition.kind==='refused')return partition
    const browserProgram=partition.browserProgram
    const serverRows=partition.serverOrdinals.map(ordinal=>({ordinal,descriptor:original.scripts[ordinal]!}))
    const browserIndices=new Map(browserProgram?.scripts.map((script,index)=>[script.ordinal,index])??[])
    const serverIndices=new Map(serverRows.map((row,index)=>[row.ordinal,index]))
    let serverProgram:CombinedAuthorProgramV5['serverProgram']=null
    if(serverRows.length) {
      const result=await deps.server.compile({...original,scripts:serverRows.map(row=>row.descriptor),executionPlan:null},signal)
      if(result.kind==='refused')return result
      serverProgram=result.program
    }
    if(signal?.aborted)return refused('COMBINED_COMPILER_CANCELLED')
    const rows:CombinedPlanRowV3[]=scripts.map(({descriptor,ordinal})=>{
      const base={originalOrdinal:ordinal,identity:descriptor.identity,pointer:descriptor.pointer,
        enabled:descriptor.enabled,sourceSha256:descriptor.sourceSha256,rawDescriptorSha256:recordSha256(descriptor)}
      const promptIndex=promptIndices.get(ordinal)
      if(promptIndex!==undefined)return {...base,disposition:'prompt',promptIndex}
      const browserIndex=browserIndices.get(ordinal)
      if(browserIndex!==undefined) {
        return {...base,browserIndex,disposition:descriptor.enabled?'browser':'disabled-source-retained'}
      }
      const serverIndex=serverIndices.get(ordinal)!,plan=serverProgram!.executionPlan.scripts[serverIndex]!
      return {...base,serverIndex,disposition:'server',
        classification:plan.classification as 'server-schema'|'native-state-loader'}
    })
    const planBody={schemaVersion:3 as const,encoding:'native-author-complete-execution-plan-v3' as const,
      authority:'compiled-program-data-only' as const,scripts:rows,
      summary:{enabledServerSchema:serverProgram?.executionPlan.summary.enabledServerSchema??0,
        enabledNativeLoaders:serverProgram?.executionPlan.summary.enabledNativeLoaders??0,
        enabledBrowser:rows.filter(row=>row.disposition==='browser').length,
        disabled:rows.filter(row=>row.disposition==='disabled-source-retained').length,enabledPrompt:promptOrdinals.length}}
    const executionPlan:AuthorExecutionPlanV3={...planBody,executionPlanSha256:recordSha256(planBody)}
    const body={schemaVersion:5 as const,encoding:'native-author-combined-program-v5' as const,
      authority:'compiled-program-data-only' as const,compiler:identity,original,
      sourceRecordSessionId:input.sourceRecordSessionId,executionPlan,serverProgram,browserProgram,promptProgram}
    return {kind:'compiled',program:{...body,combinedProgramSha256:recordSha256(body)}}
  }
  return {identity,compile,async verifyProgram(program,signal) {
    if(program.schemaVersion!==5)return false
    try {
      const checked=validateCombinedAuthorProgramV5(program)
      const fresh=await compile({schemaVersion:5,encoding:'native-author-combined-compilation-input-v5',
        original:checked.original,sourceRecordSessionId:checked.sourceRecordSessionId},signal)
      return fresh.kind==='compiled'&&recordSha256(fresh.program)===recordSha256(checked)
    }catch {return false}
  }}
}
