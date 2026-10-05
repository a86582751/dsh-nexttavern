/** Pure compilation over admitted implementations. Source currentness, Native
 * publication and Browser activation remain with the actual live Core owner. */
import {recordSha256} from './roleplay-data.js'
import {validateSchemaCompilationInputV4} from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaCompilerV4} from './tavern-mvu-schema-program-v4.js'
import type {BrowserPartitionCompilerV1,BrowserProgramSourceLocatorV1} from './tavern-author-browser-types.mjs'
import type {AuthorExecutionPlanV2,CombinedAuthorProgramV3,CombinedCompilationInputV3,
  CombinedCompilationV3,CombinedCompilerIdentityV1,CombinedPlanRowV2,CombinedAuthorCompilerV3}
  from './tavern-author-combined-types.mjs'
import {validateCombinedAuthorProgramV3} from './tavern-author-combined-data.mjs'

export function createCombinedAuthorCompilerV3(deps:{readonly server:MvuSchemaCompilerV4;
  readonly browser:BrowserPartitionCompilerV1;readonly implementationSha256:string}):CombinedAuthorCompilerV3 {
  // The owned package factory supplies its admitted implementation bytes.
  // These compilation identities are DATA; they do not mint a live lease.
  const identity:CombinedCompilerIdentityV1=Object.freeze({id:'native-author-combined-compiler',version:1,hostProtocol:5,
    implementationSha256:recordSha256({implementationSha256:deps.implementationSha256,
      server:deps.server.identity,browser:deps.browser.identity})})
  const refused=(code:string):CombinedCompilationV3=>({kind:'refused',diagnostics:[{code}]})
  async function compile(input:CombinedCompilationInputV3,signal?:AbortSignal):Promise<CombinedCompilationV3> {
    if(signal?.aborted)return refused('COMBINED_COMPILER_CANCELLED')
    let original:CombinedCompilationInputV3['original']
    try {original=validateSchemaCompilationInputV4(input.original)}
    catch {return refused('COMBINED_ORIGINAL_INPUT_INVALID')}
    const {material:_material,...source}=original.source
    const locator:BrowserProgramSourceLocatorV1={...source,sourceRecordSessionId:input.sourceRecordSessionId}
    const partition=await deps.browser.partition({schemaVersion:1,
      encoding:'native-author-browser-compilation-input-v1',source:locator,
      scripts:original.scripts.map((descriptor,ordinal)=>({ordinal,descriptor}))},signal)
    if(partition.kind==='refused')return partition
    const browserProgram=partition.browserProgram
    const serverRows=partition.serverOrdinals.map(ordinal=>({ordinal,descriptor:original.scripts[ordinal]!}))
    const browserIndices=new Map(browserProgram?.scripts.map((script,index)=>[script.ordinal,index])??[])
    const serverIndices=new Map(serverRows.map((row,index)=>[row.ordinal,index]))
    let serverProgram:CombinedAuthorProgramV3['serverProgram']=null
    if(serverRows.length) {
      // Native indices are contiguous in the real compiler4 subset. Plan2
      // retains the original ordinals and proves the complete association.
      const server=await deps.server.compile({...original,
        scripts:serverRows.map(row=>row.descriptor),executionPlan:null},signal)
      if(server.kind==='refused')return server
      serverProgram=server.program
    }
    if(signal?.aborted)return refused('COMBINED_COMPILER_CANCELLED')
    const rows:CombinedPlanRowV2[]=original.scripts.map((descriptor,ordinal)=>{
      const base={originalOrdinal:ordinal,identity:descriptor.identity,pointer:descriptor.pointer,
        enabled:descriptor.enabled,sourceSha256:descriptor.sourceSha256,rawDescriptorSha256:recordSha256(descriptor)}
      const browserIndex=browserIndices.get(ordinal)
      if(browserIndex!==undefined) {
        return {...base,browserIndex,disposition:descriptor.enabled?'browser':'disabled-source-retained'}
      }
      const serverIndex=serverIndices.get(ordinal)!,plan=serverProgram!.executionPlan.scripts[serverIndex]!
      return {...base,serverIndex,disposition:'server',
        classification:plan.classification as 'server-schema'|'native-state-loader'}
    })
    const planBody={schemaVersion:2 as const,encoding:'native-author-complete-execution-plan-v2' as const,
      authority:'compiled-program-data-only' as const,scripts:rows,
      summary:{enabledServerSchema:serverProgram?.executionPlan.summary.enabledServerSchema??0,
        enabledNativeLoaders:serverProgram?.executionPlan.summary.enabledNativeLoaders??0,
        enabledBrowser:rows.filter(row=>row.disposition==='browser').length,
        disabled:rows.filter(row=>row.disposition==='disabled-source-retained').length}}
    const executionPlan:AuthorExecutionPlanV2={...planBody,executionPlanSha256:recordSha256(planBody)}
    const body={schemaVersion:3 as const,encoding:'native-author-combined-program-v3' as const,
      authority:'compiled-program-data-only' as const,compiler:identity,original,
      sourceRecordSessionId:input.sourceRecordSessionId,executionPlan,serverProgram,browserProgram}
    return {kind:'compiled',program:{...body,combinedProgramSha256:recordSha256(body)}}
  }
  return {identity,compile,
    async verifyProgram(program,signal) {
      try {
        program=validateCombinedAuthorProgramV3(program)
        const fresh=await compile({schemaVersion:3,encoding:'native-author-combined-compilation-input-v3',
          original:program.original,sourceRecordSessionId:program.sourceRecordSessionId},signal)
        return fresh.kind==='compiled'&&recordSha256(fresh.program)===recordSha256(program)
      }catch {return false}
    }}
}
