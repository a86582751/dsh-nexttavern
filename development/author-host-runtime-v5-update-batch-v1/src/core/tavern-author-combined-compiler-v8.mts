/** Actual numerical claims and native Source execution share one Original.
 * Ordinary helper scripts are never admitted by a finite Browser/Prompt AST. */
import {recordSha256} from './roleplay-data.js'
import {captureAuthorNativeProgramV1} from './author-native-program.mjs'
import type {CombinedCompilerIdentityV1} from './tavern-author-combined-types.mjs'
import type {AuthorExecutionPlanV4,CombinedPlanRowV4,CombinedAuthorCompilerV8,
  CombinedAuthorProgramV8,CombinedCompilationV8} from './tavern-author-combined-types-v8.mjs'
import {validateCombinedAuthorProgramV8,combinedCompilationInputForProgramV8,captureCompiledCombinedAuthorProgramV8}
  from './tavern-author-combined-data-v8.mjs'
import {EXTERNAL_ADDON_CATALOG_V1,EXTERNAL_ADDON_RUNTIME_UNAVAILABLE,identifyUnavailableExternalAddonV1}
  from './tavern-author-external-addons.mjs'
import type {ExternalAddonDependencyV1} from './tavern-author-external-addons.mjs'
import type {MvuOwnedStateCandidateCompilerV1} from './tavern-mvu-owned-state-types-v1.mjs'

export interface CombinedCompilerDepsV8 {
  readonly server:MvuOwnedStateCandidateCompilerV1
  readonly implementationSha256:string
}
export function createCombinedAuthorCompilerV8(deps:CombinedCompilerDepsV8):CombinedAuthorCompilerV8 {
  const identity:CombinedCompilerIdentityV1=Object.freeze({id:'native-author-combined-compiler',version:1,hostProtocol:5,
    implementationSha256:recordSha256({implementationSha256:deps.implementationSha256,
      externalAddons:EXTERNAL_ADDON_CATALOG_V1,sourceDispositionPlan:4,nativeSource:1,
      server:deps.server.identity})})
  const refused=(code:string):CombinedCompilationV8=>({kind:'refused',diagnostics:[{code}]})
  const compile:CombinedAuthorCompilerV8['compile']=async(input,signal)=>{
    if(signal?.aborted)return refused('COMBINED_COMPILER_CANCELLED')
    if(input.schemaVersion!==8||input.encoding!=='native-author-combined-compilation-input-v8')
      return refused('COMBINED_COMPILER_INPUT_VERSION')
    const server=await deps.server.partitionCandidates(input.original,signal)
    if(server.kind==='refused')return server.diagnostics[0]?.code==='MVU_SCHEMA_COMPILER_INPUT_INVALID'
      ?refused('COMBINED_ORIGINAL_INPUT_INVALID'):server
    const original=server.original
    const serverIndices=new Map(server.serverOrdinals.map((ordinal,index)=>[ordinal,index]))
    const externalAddons=new Map<number,ExternalAddonDependencyV1>()
    const nativeOrdinals=new Set<number>()
    for(const [ordinal,descriptor] of original.scripts.entries()){
      if(serverIndices.has(ordinal))continue
      const dependency=identifyUnavailableExternalAddonV1(descriptor)
      if(dependency)externalAddons.set(ordinal,dependency)
      else nativeOrdinals.add(ordinal)
    }
    const nativeProgram=nativeOrdinals.size?captureAuthorNativeProgramV1({source:original.source,
      sourceRecordSessionId:input.sourceRecordSessionId,scripts:original.scripts,
      realms:input.nativeLayout.realms.map(realm=>({...realm,
        originalOrdinals:realm.originalOrdinals.filter(ordinal=>nativeOrdinals.has(ordinal))}))
        .filter(realm=>realm.originalOrdinals.length>0)}):null
    const nativeIndices=new Map(nativeProgram?.scripts.map((script,index)=>[script.originalOrdinal,index])??[])
    let serverProgram:CombinedAuthorProgramV8['serverProgram']=server.serverProgram
    // The SDK permission-group owner chose this policy before compilation.
    // Existing schema/loader ownership remains the same numerical owner; a
    // native helper never creates a second numerical framework alongside it.
    if(!serverProgram&&nativeProgram?.scripts.some(script=>script.enabled)
      &&input.nativeLayout.numericalProfile==='native-mvu-state-v1')
      serverProgram=deps.server.assembleOwnedStateProgram(original,input.nativeLayout.numericalProfile)
    const rows:CombinedPlanRowV4[]=original.scripts.map((descriptor,ordinal)=>{
      const serverIndex=serverIndices.get(ordinal),nativeIndex=nativeIndices.get(ordinal)
      const serverRow=server.serverProgram?.executionPlan.scripts[serverIndex!]
      const nativeRow=nativeProgram?.scripts[nativeIndex!]
      const base={originalOrdinal:ordinal,identity:descriptor.identity,pointer:descriptor.pointer,
        enabled:descriptor.enabled,sourceSha256:descriptor.sourceSha256,
        rawDescriptorSha256:serverRow?.rawDescriptorSha256??nativeRow?.descriptorSha256??recordSha256(descriptor)}
      const dependency=externalAddons.get(ordinal)
      if(dependency)return {...base,enabled:true,disposition:'external-addon-unavailable',dependency,
        reason:EXTERNAL_ADDON_RUNTIME_UNAVAILABLE}
      if(serverIndex!==undefined)return {...base,disposition:'server',serverIndex,
        classification:serverRow!.classification as 'server-schema'|'native-state-loader'}
      return {...base,nativeIndex:nativeIndex!,disposition:descriptor.enabled?'native':'disabled-source-retained'}
    })
    const planBody={schemaVersion:4 as const,encoding:'native-author-source-disposition-plan-v4' as const,
      authority:'compiled-program-data-only' as const,scripts:rows,
      summary:{enabledServerSchema:server.serverProgram?.executionPlan.summary.enabledServerSchema??0,
        enabledNativeLoaders:server.serverProgram?.executionPlan.summary.enabledNativeLoaders??0,
        enabledNative:rows.filter(row=>row.disposition==='native').length,
        disabled:rows.filter(row=>row.disposition==='disabled-source-retained').length,
        enabledExternalAddonsUnavailable:externalAddons.size}}
    const executionPlan:AuthorExecutionPlanV4={...planBody,executionPlanSha256:recordSha256(planBody)}
    const body={schemaVersion:8 as const,encoding:'native-author-combined-program-v8' as const,
      authority:'compiled-program-data-only' as const,compiler:identity,original,
      sourceRecordSessionId:input.sourceRecordSessionId,nativeLayout:input.nativeLayout,
      executionPlan,serverProgram,nativeProgram}
    try {
      const program=captureCompiledCombinedAuthorProgramV8({...body,combinedProgramSha256:recordSha256(body)})
      return {kind:'compiled',program}
    }catch {return refused('COMBINED8_PROGRAM_DATA_LIMIT')}
  }
  return {identity,compile,async verifyProgram(program,signal) {
    if(program.schemaVersion!==8)return false
    try {
      const checked=validateCombinedAuthorProgramV8(program)
      const fresh=await compile(combinedCompilationInputForProgramV8(checked),signal)
      return fresh.kind==='compiled'&&recordSha256(fresh.program)===recordSha256(checked)
    }catch {return false}
  }}
}
