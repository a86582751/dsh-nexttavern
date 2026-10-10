/** Combined6 keeps the actual ABI4/Prompt1 projections and gives captured HTML
 * candidates to Browser3's complete Native-effect and page-mount admission.
 * This factory constructs DATA only; Host5 currently has no Combined6 loader. */
import {recordSha256} from './roleplay-data.js'
import {validateSchemaCompilationInputV4} from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaCompilerV4} from './tavern-mvu-schema-program-v4.js'
import {projectAuthorScriptResourcesV3} from './tavern-author-browser-source-projection-v3.mjs'
import type {AuthorScriptResourceReaderV1,AuthorScriptResourceDescriptorV1}
  from './roleplay-author-script-resources.js'
import type {BrowserPartitionCompilerV2} from './tavern-author-browser-types-v2.mjs'
import type {BrowserCompilerV3} from './tavern-author-browser-types-v3.mjs'
import type {BrowserProgramSourceLocatorV1} from './tavern-author-browser-types.mjs'
import type {SourceHtmlInputV1} from './tavern-author-html-types-v1.mjs'
import type {PromptCompilerV1} from './tavern-author-prompt-types.mjs'
import type {AuthorExecutionPlanV3,CombinedCompilerIdentityV1,CombinedPlanRowV3}
  from './tavern-author-combined-types.mjs'
import type {CombinedAuthorCompilerV6,CombinedAuthorProgramV6,CombinedCompilationV6}
  from './tavern-author-combined-types-v6.mjs'
import {validateCombinedAuthorProgramV6,combinedCompilationInputForProgramV6,captureCompiledCombinedAuthorProgramV6}
  from './tavern-author-combined-data-v6.mjs'

export interface CombinedCompilerDepsV6 {
  readonly server:MvuSchemaCompilerV4
  readonly browserPartition:BrowserPartitionCompilerV2
  readonly browser:BrowserCompilerV3
  readonly prompt:PromptCompilerV1
  readonly implementationSha256:string
  /** Source's owner supplies the reader of this already captured material.
   * Neither posted resource DATA nor a fresh production Source capture enters
   * this callback. Its frame has the actual document/snapshot metadata. */
  resources?(source:CombinedAuthorProgramV6['original']['source'],
    pins:readonly AuthorScriptResourceDescriptorV1[]):AuthorScriptResourceReaderV1
}

export function createCombinedAuthorCompilerV6(deps:CombinedCompilerDepsV6):CombinedAuthorCompilerV6 {
  const browser=deps.browser
  const identity:CombinedCompilerIdentityV1=Object.freeze({id:'native-author-combined-compiler',version:1,hostProtocol:5,
    implementationSha256:recordSha256({implementationSha256:deps.implementationSha256,
      server:deps.server.identity,browser:{compiler:browser.identity,runtime:browser.runtime},
      partition:{compiler:deps.browserPartition.identity,runtime:deps.browserPartition.runtime},
      prompt:{compiler:deps.prompt.identity,runtime:deps.prompt.runtime}})})
  const refused=(code:string):CombinedCompilationV6=>({kind:'refused',diagnostics:[{code}]})
  const compile:CombinedAuthorCompilerV6['compile']=async(input,signal,capturedResources)=>{
    if(signal?.aborted)return refused('COMBINED_COMPILER_CANCELLED')
    if(input.schemaVersion!==6||input.encoding!=='native-author-combined-compilation-input-v6')
      return refused('COMBINED_COMPILER_INPUT_VERSION')
    let original:CombinedAuthorProgramV6['original']
    try {original=validateSchemaCompilationInputV4(input.original)}
    catch {return refused('COMBINED_ORIGINAL_INPUT_INVALID')}
    const {material:_material,...source}=original.source
    const locator:BrowserProgramSourceLocatorV1={...source,sourceRecordSessionId:input.sourceRecordSessionId}
    const scripts=original.scripts.map((descriptor,ordinal)=>({ordinal,descriptor}))
    let promptProgram:CombinedAuthorProgramV6['promptProgram']=null
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
    const remaining=scripts.filter(row=>!promptIndices.has(row.ordinal))
    let browserProgram:CombinedAuthorProgramV6['browserProgram']=null
    let serverOrdinals:readonly number[]=[]
    if(remaining.length) {
      const pins=remaining.map(({ordinal,descriptor})=>({originalOrdinal:ordinal,identity:descriptor.identity,
        pointer:descriptor.pointer,rawDescriptorSha256:recordSha256(descriptor)}))
      let sourceResources:ReturnType<typeof projectAuthorScriptResourcesV3>
      try {sourceResources=projectAuthorScriptResourcesV3((capturedResources??deps.resources)!(original.source,pins),pins)}
      catch {return refused('COMBINED_SOURCE_RESOURCES_UNAVAILABLE')}
      const sourcePages:SourceHtmlInputV1[]=[]
      for(const caller of sourceResources.callers) {
        const raw=original.scripts[caller.originalOrdinal]!,data=caller.data
        if(raw.enabled&&data!==null&&typeof data==='object'&&!Array.isArray(data)&&typeof data.html==='string') {
          sourcePages.push({schemaVersion:1,encoding:'source-html-compile-input-v1',source:locator,
            carrier:{originalOrdinal:caller.originalOrdinal,identity:raw.identity,pointer:raw.pointer,
              descriptorSha256:recordSha256(raw)},resourcePath:['data','html'],html:data.html})
        }
      }
      const pageOrdinals=new Set(sourcePages.map(page=>page.carrier.originalOrdinal))
      // A resource field requests admission; it never establishes Browser
      // disposition. Browser3 must prove the mount and all Native effects.
      // A refusal is terminal: no server fallback can discard page effects.
      const partition=await deps.browserPartition.partition({schemaVersion:2,
        encoding:'native-author-browser-compilation-input-v2',source:locator,
        scripts:remaining.filter(row=>!pageOrdinals.has(row.ordinal))},signal)
      if(partition.kind==='refused')return partition
      serverOrdinals=partition.serverOrdinals
      const browserOrdinals=new Set([...pageOrdinals,...partition.browserProgram?.scripts.map(row=>row.ordinal)??[]])
      if(browserOrdinals.size) {
        const result=await browser.compile({schemaVersion:3,encoding:'native-author-browser-compilation-input-v3',source:locator,
          scripts:remaining.filter(row=>browserOrdinals.has(row.ordinal)),sourcePages,sourceResources},signal)
        if(result.kind==='refused')return result
        browserProgram=result.program
      }
    }
    if(signal?.aborted)return refused('COMBINED_COMPILER_CANCELLED')
    const serverRows=serverOrdinals.map(ordinal=>({ordinal,descriptor:original.scripts[ordinal]!}))
    const browserIndices=new Map(browserProgram?.scripts.map((script,index)=>[script.ordinal,index])??[])
    const serverIndices=new Map(serverRows.map((row,index)=>[row.ordinal,index]))
    let serverProgram:CombinedAuthorProgramV6['serverProgram']=null
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
      if(browserIndex!==undefined)return {...base,browserIndex,disposition:descriptor.enabled?'browser':'disabled-source-retained'}
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
    const body={schemaVersion:6 as const,encoding:'native-author-combined-program-v6' as const,
      authority:'compiled-program-data-only' as const,compiler:identity,original,
      sourceRecordSessionId:input.sourceRecordSessionId,executionPlan,serverProgram,browserProgram,promptProgram}
    try {
      const program=captureCompiledCombinedAuthorProgramV6({...body,combinedProgramSha256:recordSha256(body)})
      return {kind:'compiled',program}
    }catch {
      return refused('COMBINED6_PROGRAM_DATA_LIMIT')
    }
  }
  return {identity,compile,async verifyProgram(program,signal,resources) {
    if(program.schemaVersion!==6)return false
    try {
      const checked=validateCombinedAuthorProgramV6(program)
      const fresh=await compile(combinedCompilationInputForProgramV6(checked),signal,resources)
      return fresh.kind==='compiled'&&recordSha256(fresh.program)===recordSha256(checked)
    }catch {return false}
  }}
}
