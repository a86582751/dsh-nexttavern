/** Versioned stored compilation DATA. This decoder cannot authorize execution,
 * current Source, Browser ready, or Native publication. */
import {recordSha256} from './roleplay-data.js'
import {cloneSchemaEnvelopeV4} from './tavern-mvu-schema-data.js'
import {validateSchemaCompilationInputV4,validateSchemaProgramV4}
  from './tavern-mvu-schema-program-v4.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import type {CombinedAuthorProgramV3,CombinedPlanRowV2} from './tavern-author-combined-types.mjs'
const same=(left:unknown,right:unknown)=>recordSha256(left)===recordSha256(right)
function fail():never {throw Error('COMBINED_PROGRAM_DATA_INVALID')}
const hash=(value:unknown)=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value)
const validatedPrograms=new WeakSet<object>()
function exact(value:object,keys:readonly string[]):void {
  if(!value||typeof value!=='object'||!same(Object.keys(value).sort(),[...keys].sort()))fail()
}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)) {
    for(const child of Object.values(value))freeze(child)
    Object.freeze(value)
  }
  return value
}

export function validateCombinedAuthorProgramV3(input:unknown):CombinedAuthorProgramV3 {
  if(validatedPrograms.has(input as object))return input as CombinedAuthorProgramV3
  // Reuse the existing complete Source material owner; the combined envelope
  // changes neither its 64 MiB aggregate nor numerical/code metadata limits.
  const program=cloneSchemaEnvelopeV4(input,MVU_SCHEMA_BOUNDS.programBytes) as CombinedAuthorProgramV3
  exact(program,['schemaVersion','encoding','authority','compiler','original','sourceRecordSessionId',
    'executionPlan','serverProgram','browserProgram','combinedProgramSha256'])
  if(program.schemaVersion!==3||program.encoding!=='native-author-combined-program-v3'
    ||program.authority!=='compiled-program-data-only'||!hash(program.combinedProgramSha256)
    ||typeof program.sourceRecordSessionId!=='string'||!program.sourceRecordSessionId.length
    ||program.sourceRecordSessionId.length>256)fail()
  exact(program.compiler,['id','version','hostProtocol','implementationSha256'])
  if(program.compiler.id!=='native-author-combined-compiler'||program.compiler.version!==1
    ||program.compiler.hostProtocol!==5||!hash(program.compiler.implementationSha256))fail()
  const original=validateSchemaCompilationInputV4(program.original)
  const server=program.serverProgram===null?null:validateSchemaProgramV4(program.serverProgram)
  const browser=program.browserProgram
  if(server&&!same(server.source,original.source))fail()
  if(browser) {
    exact(browser,['schemaVersion','encoding','authority','source','compiler','profile','runtime',
      'capabilityContract','scripts','requiredCapabilities','programSha256'])
    if(browser.schemaVersion!==1||browser.encoding!=='native-author-browser-program-v1'
      ||browser.authority!=='compiled-program-data-only'||!Array.isArray(browser.scripts))fail()
    const {material:_material,...source}=original.source
    if(!same(browser.source,{...source,sourceRecordSessionId:program.sourceRecordSessionId}))fail()
    const {programSha256,...body}=browser
    if(!hash(programSha256)||recordSha256(body)!==programSha256)fail()
  }else if(browser!==null)fail()
  const plan=program.executionPlan
  exact(plan,['schemaVersion','encoding','authority','scripts','summary','executionPlanSha256'])
  if(plan.schemaVersion!==2||plan.encoding!=='native-author-complete-execution-plan-v2'
    ||plan.authority!=='compiled-program-data-only'||!Array.isArray(plan.scripts)
    ||plan.scripts.length!==original.scripts.length)fail()
  let serverIndex=0,browserIndex=0,enabledBrowser=0,disabled=0
  for(const [ordinal,row] of plan.scripts.entries()) {
    const descriptor=original.scripts[ordinal]!
    const common:Omit<CombinedPlanRowV2,'disposition'>={originalOrdinal:ordinal,identity:descriptor.identity,
      pointer:descriptor.pointer,enabled:descriptor.enabled,sourceSha256:descriptor.sourceSha256,
      rawDescriptorSha256:recordSha256(descriptor)}
    if(row.disposition==='server') {
      if(!descriptor.enabled||!server||row.serverIndex!==serverIndex)fail()
      const compiled=server.scripts[serverIndex],classified=server.executionPlan.scripts[serverIndex]
      if(!compiled||!classified)fail()
      const {javascript:_js,javascriptSha256:_sha,...raw}=compiled
      if(!same(raw,descriptor)||!same(row,{...common,disposition:'server',serverIndex,
        classification:classified.classification}))fail()
      serverIndex++
    }else if(row.disposition==='browser'||row.disposition==='disabled-source-retained') {
      const compiled=browser?.scripts[browserIndex]
      const disposition=descriptor.enabled?'browser':'disabled-source-retained'
      if(!compiled||row.browserIndex!==browserIndex||compiled.ordinal!==ordinal
        ||!same(compiled.descriptor,descriptor)||compiled.descriptorSha256!==recordSha256(descriptor)
        ||compiled.disposition!==(descriptor.enabled?'compiled-browser':'disabled-source-retained')
        ||!same(row,{...common,disposition,browserIndex}))fail()
      if(descriptor.enabled)enabledBrowser++;else disabled++
      browserIndex++
    }else fail()
  }
  if(serverIndex!==(server?.scripts.length??0)||browserIndex!==(browser?.scripts.length??0))fail()
  if(!same(plan.summary,{enabledServerSchema:server?.executionPlan.summary.enabledServerSchema??0,
    enabledNativeLoaders:server?.executionPlan.summary.enabledNativeLoaders??0,enabledBrowser,disabled}))fail()
  const {executionPlanSha256,...planBody}=plan
  if(!hash(executionPlanSha256)||recordSha256(planBody)!==executionPlanSha256)fail()
  const {combinedProgramSha256,...body}=program
  if(recordSha256(body)!==combinedProgramSha256)fail()
  freeze(program);validatedPrograms.add(program)
  return program
}
