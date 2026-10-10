/** Combined5 durable DATA binds the complete original descriptor list to its
 * three owned projections. Nested decoders own their own version contracts. */
import {recordSha256} from './roleplay-data.js'
import {cloneSchemaEnvelopeV4} from './tavern-mvu-schema-data.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import {validateSchemaCompilationInputV4,validateSchemaProgramV4} from './tavern-mvu-schema-program-v4.js'
import {validatePromptProgramV1} from './tavern-author-prompt-data.mjs'
import {validateBrowserProgramV2} from './tavern-author-browser-compiler-v2.mjs'
import type {CombinedAuthorProgramV5} from './tavern-author-combined-types-v5.mjs'
import type {CombinedPlanRowV3} from './tavern-author-combined-types.mjs'

const validatedPrograms=new WeakSet<object>()
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
function fail():never {throw Error('COMBINED_PROGRAM_DATA_INVALID')}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)) {
    for(const child of Object.values(value))freeze(child)
    Object.freeze(value)
  }
  return value
}

export function validateCombinedAuthorProgramV5(input:unknown):CombinedAuthorProgramV5 {
  if(validatedPrograms.has(input as object))return input as CombinedAuthorProgramV5
  const program=cloneSchemaEnvelopeV4(input,MVU_SCHEMA_BOUNDS.programBytes) as CombinedAuthorProgramV5
  if(program.schemaVersion!==5||program.encoding!=='native-author-combined-program-v5'
    ||program.authority!=='compiled-program-data-only'||typeof program.sourceRecordSessionId!=='string'
    ||!program.sourceRecordSessionId.length||program.sourceRecordSessionId.length>256)fail()
  if(program.compiler?.id!=='native-author-combined-compiler'||program.compiler.version!==1
    ||program.compiler.hostProtocol!==5||!/^[a-f0-9]{64}$/.test(program.compiler.implementationSha256))fail()
  const original=validateSchemaCompilationInputV4(program.original)
  const server=program.serverProgram===null?null:validateSchemaProgramV4(program.serverProgram)
  const browser=program.browserProgram===null?null:validateBrowserProgramV2(program.browserProgram)
  const prompt=program.promptProgram===null?null:validatePromptProgramV1(program.promptProgram)
  const {material:_material,...source}=original.source
  const locator={...source,sourceRecordSessionId:program.sourceRecordSessionId}
  if(server&&!same(server.source,original.source)||browser&&!same(browser.source,locator)
    ||prompt&&!same(prompt.source,locator))fail()
  const plan=program.executionPlan
  if(plan?.schemaVersion!==3||plan.encoding!=='native-author-complete-execution-plan-v3'
    ||plan.authority!=='compiled-program-data-only'||!Array.isArray(plan.scripts)
    ||plan.scripts.length!==original.scripts.length)fail()
  let serverIndex=0,browserIndex=0,promptIndex=0,enabledBrowser=0,disabled=0
  for(const [ordinal,row] of plan.scripts.entries()) {
    const descriptor=original.scripts[ordinal]!
    const common={originalOrdinal:ordinal,identity:descriptor.identity,pointer:descriptor.pointer,
      enabled:descriptor.enabled,sourceSha256:descriptor.sourceSha256,rawDescriptorSha256:recordSha256(descriptor)}
    let expected:CombinedPlanRowV3
    if(row.disposition==='server') {
      const compiled=server?.scripts[serverIndex],classified=server?.executionPlan.scripts[serverIndex]
      if(!descriptor.enabled||!compiled||!classified)fail()
      const {javascript:_javascript,javascriptSha256:_sha,...raw}=compiled
      if(!same(raw,descriptor))fail()
      expected={...common,disposition:'server',serverIndex,
        classification:classified.classification as 'server-schema'|'native-state-loader'}
      serverIndex++
    }else if(row.disposition==='prompt') {
      const compiled=prompt?.scripts[promptIndex]
      if(!descriptor.enabled||!compiled||compiled.disposition!=='compiled-prompt'
        ||compiled.ordinal!==ordinal||!same(compiled.descriptor,descriptor))fail()
      expected={...common,disposition:'prompt',promptIndex}
      promptIndex++
    }else if(row.disposition==='browser'||row.disposition==='disabled-source-retained') {
      const compiled=browser?.scripts[browserIndex]
      if(!compiled||compiled.ordinal!==ordinal||!same(compiled.descriptor,descriptor)
        ||compiled.disposition!==(descriptor.enabled?'compiled-browser':'disabled-source-retained'))fail()
      expected={...common,disposition:descriptor.enabled?'browser':'disabled-source-retained',browserIndex}
      if(descriptor.enabled)enabledBrowser++;else disabled++
      browserIndex++
    }else fail()
    if(!same(row,expected))fail()
  }
  if(serverIndex!==(server?.scripts.length??0)||browserIndex!==(browser?.scripts.length??0)
    ||promptIndex!==(prompt?.scripts.length??0))fail()
  if(!same(plan.summary,{enabledServerSchema:server?.executionPlan.summary.enabledServerSchema??0,
    enabledNativeLoaders:server?.executionPlan.summary.enabledNativeLoaders??0,enabledBrowser,disabled,
    enabledPrompt:promptIndex}))fail()
  const {executionPlanSha256,...planBody}=plan
  if(recordSha256(planBody)!==executionPlanSha256)fail()
  const {combinedProgramSha256,...body}=program
  if(recordSha256(body)!==combinedProgramSha256)fail()
  freeze(program);validatedPrograms.add(program)
  return program
}
