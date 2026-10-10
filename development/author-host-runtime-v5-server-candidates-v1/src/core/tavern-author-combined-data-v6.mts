/** Durable Combined6 DATA decoding. Checksums bind recorded projections, never
 * establish Source authority or qualify a Browser/Native execution artifact. */
import {recordSha256,sha256} from './roleplay-data.js'
import {cloneSchemaDescriptorEnvelopeV4} from './tavern-mvu-schema-data.js'
import {validateSchemaCompilationInputV4,validateSchemaProgramV4} from './tavern-mvu-schema-program-v4.js'
import {validatePromptProgramV1} from './tavern-author-prompt-data.mjs'
import type {BrowserProgramV3} from './tavern-author-browser-types-v3.mjs'
import type {CombinedAuthorProgramV6} from './tavern-author-combined-types-v6.mjs'
import {COMBINED_AUTHOR_DATA_BOUNDS_V6 as bounds} from './tavern-author-combined-types-v6.mjs'
import type {CombinedPlanRowV3} from './tavern-author-combined-types.mjs'

const validatedPrograms=new WeakSet<object>()
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
const hash=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
function fail():never {throw Error('COMBINED6_PROGRAM_DATA_INVALID')}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)) {
    for(const child of Object.values(value))freeze(child)
    Object.freeze(value)
  }
  return value
}
function captureRecord(input:unknown):CombinedAuthorProgramV6 {
  return cloneSchemaDescriptorEnvelopeV4(input,bounds.descriptorBytes,
    {nodes:bounds.descriptorNodes,depth:bounds.descriptorDepth,
      arrayLength:bounds.descriptorArrayLength}) as CombinedAuthorProgramV6
}
/** The actual compiler has already built valid nested projections. This DATA
 * capture applies the same record budget as cold decoding and retains immutable
 * bytes, without another AST/semantic validation or a validated-program brand. */
export function captureCompiledCombinedAuthorProgramV6(program:CombinedAuthorProgramV6):CombinedAuthorProgramV6 {
  return freeze(captureRecord(program))
}
function checksum<T extends object>(value:T,key:keyof T):void {
  const {[key]:expected,...body}=value
  if(!hash(expected)||recordSha256(body)!==expected)fail()
}
/** Browser3 has no stored-DATA decoder yet. This owner checks its tagged record
 * and recorded nested checksums once, without repeating its AST analysis. */
function browserData(program:BrowserProgramV3):BrowserProgramV3 {
  if(program.schemaVersion!==3||program.encoding!=='native-author-browser-program-v3'
    ||program.authority!=='compiled-program-data-only'||!Array.isArray(program.scripts)
    ||!Array.isArray(program.sourcePages)||!Array.isArray(program.declarations)
    ||!Array.isArray(program.requiredCapabilities)||program.compiler?.version!==3
    ||program.compiler.id!=='native-author-browser-profile-compiler'
    ||program.compiler.typescriptVersion!=='5.9.3'||!hash(program.compiler.implementationSha256)
    ||program.runtime?.id!=='native-author-browser-runtime'||program.runtime.version!==3
    ||program.runtime.quickjsVersion!=='0.32.0'||!hash(program.runtime.implementationSha256)
    ||program.profile?.id!=='nexttavern-browser-source-html'||program.profile.version!==3
    ||!hash(program.profile.sha256)||program.capabilityContract?.schemaVersion!==3
    ||program.capabilityContract.authority!=='requirements-only')fail()
  checksum(program.capabilityContract,'contractSha256')
  if(program.runtime.capabilityContractSha256!==program.capabilityContract.contractSha256)fail()
  for(const script of program.scripts) {
    if(script.descriptorSha256!==recordSha256(script.descriptor)
      ||script.javascript!==(script.descriptor.enabled?script.descriptor.source:'')
      ||script.javascriptSha256!==sha256(script.javascript)
      ||script.entrypoint!==(script.descriptor.enabled?'global-script':'disabled')
      ||script.descriptor.enabled&&script.coverage?.sourceSha256!==script.descriptor.sourceSha256
      ||!script.descriptor.enabled&&script.coverage!==null)fail()
  }
  for(const page of program.sourcePages) {
    const carrier=program.scripts.find(script=>script.ordinal===page.origin.carrier.originalOrdinal)
    if(page.schemaVersion!==3||page.encoding!=='native-author-browser-source-page-plan-v3'
      ||page.authority!=='compiled-program-data-only'||!same(page.origin.source,program.source)
      ||!same(page.parsed.origin,page.origin)||!carrier||!carrier.descriptor.enabled
      ||page.origin.carrier.identity!==carrier.descriptor.identity
      ||page.origin.carrier.pointer!==carrier.descriptor.pointer
      ||page.origin.carrier.descriptorSha256!==carrier.descriptorSha256
      ||!carrier.sourcePagePlans.includes(page.pagePlanSha256))fail()
    checksum(page.parsed,'candidateSha256')
    for(const admission of page.scripts)checksum(admission,'admissionSha256')
    checksum(page,'pagePlanSha256')
  }
  checksum(program,'programSha256')
  return program
}

export function validateCombinedAuthorProgramV6(input:unknown):CombinedAuthorProgramV6 {
  if(validatedPrograms.has(input as object))return input as CombinedAuthorProgramV6
  const program=captureRecord(input)
  if(program.schemaVersion!==6||program.encoding!=='native-author-combined-program-v6'
    ||program.authority!=='compiled-program-data-only'||typeof program.sourceRecordSessionId!=='string'
    ||!program.sourceRecordSessionId.length||program.sourceRecordSessionId.length>256)fail()
  if(program.compiler?.id!=='native-author-combined-compiler'||program.compiler.version!==1
    ||program.compiler.hostProtocol!==5||!hash(program.compiler.implementationSha256))fail()
  const original=validateSchemaCompilationInputV4(program.original)
  const server=program.serverProgram===null?null:validateSchemaProgramV4(program.serverProgram)
  const browser=program.browserProgram===null?null:browserData(program.browserProgram)
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
  checksum(plan,'executionPlanSha256')
  checksum(program,'combinedProgramSha256')
  freeze(program);validatedPrograms.add(program)
  return program
}

export function combinedCompilationInputForProgramV6(program:CombinedAuthorProgramV6) {
  return {schemaVersion:6 as const,encoding:'native-author-combined-compilation-input-v6' as const,
    original:program.original,sourceRecordSessionId:program.sourceRecordSessionId}
}
