/** Versioned stored compilation DATA. This decoder cannot authorize execution,
 * current Source, Browser ready, or Native publication. */
import {recordSha256} from './roleplay-data.js'
import {cloneSchemaEnvelopeV4} from './tavern-mvu-schema-data.js'
import {validateSchemaCompilationInputV4,validateSchemaProgramV4}
  from './tavern-mvu-schema-program-v4.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import {validatePromptProgramV1} from './tavern-author-prompt-data.mjs'
import {validateCombinedAuthorProgramV5} from './tavern-author-combined-data-v5.mjs'
import type {CombinedAuthorProgramV3,CombinedPlanRowV2,CombinedAuthorProgramV4,CombinedPlanRowV3,
  CombinedAuthorProgram,CombinedCompilationInput} from './tavern-author-combined-types.mjs'
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

const validatedProgramsV4=new WeakSet<object>()
export function validateCombinedAuthorProgramV4(input:unknown):CombinedAuthorProgramV4 {
  if(validatedProgramsV4.has(input as object))return input as CombinedAuthorProgramV4
  const program=cloneSchemaEnvelopeV4(input,MVU_SCHEMA_BOUNDS.programBytes) as CombinedAuthorProgramV4
  exact(program,['schemaVersion','encoding','authority','compiler','original','sourceRecordSessionId',
    'executionPlan','serverProgram','browserProgram','promptProgram','combinedProgramSha256'])
  if(program.schemaVersion!==4||program.encoding!=='native-author-combined-program-v4'
    ||program.authority!=='compiled-program-data-only'||!hash(program.combinedProgramSha256)
    ||typeof program.sourceRecordSessionId!=='string'||!program.sourceRecordSessionId.length
    ||program.sourceRecordSessionId.length>256)fail()
  exact(program.compiler,['id','version','hostProtocol','implementationSha256'])
  if(program.compiler.id!=='native-author-combined-compiler'||program.compiler.version!==1
    ||program.compiler.hostProtocol!==5||!hash(program.compiler.implementationSha256))fail()
  const original=validateSchemaCompilationInputV4(program.original)
  const server=program.serverProgram===null?null:validateSchemaProgramV4(program.serverProgram)
  if(server&&!same(server.source,original.source))fail()
  const {material:_material,...source}=original.source
  const locator={...source,sourceRecordSessionId:program.sourceRecordSessionId}
  const browser=program.browserProgram
  if(browser) {
    exact(browser,['schemaVersion','encoding','authority','source','compiler','profile','runtime',
      'capabilityContract','scripts','requiredCapabilities','programSha256'])
    if(browser.schemaVersion!==1||browser.encoding!=='native-author-browser-program-v1'
      ||browser.authority!=='compiled-program-data-only'||!Array.isArray(browser.scripts)
      ||!same(browser.source,locator))fail()
    const {programSha256,...body}=browser
    if(!hash(programSha256)||recordSha256(body)!==programSha256)fail()
  }else if(browser!==null)fail()
  const prompt=program.promptProgram===null?null:validatePromptProgramV1(program.promptProgram)
  if(prompt&&!same(prompt.source,locator))fail()
  const plan=program.executionPlan
  exact(plan,['schemaVersion','encoding','authority','scripts','summary','executionPlanSha256'])
  if(plan.schemaVersion!==3||plan.encoding!=='native-author-complete-execution-plan-v3'
    ||plan.authority!=='compiled-program-data-only'||!Array.isArray(plan.scripts)
    ||plan.scripts.length!==original.scripts.length)fail()
  let serverIndex=0,browserIndex=0,promptIndex=0,enabledBrowser=0,disabled=0
  for(const [ordinal,row] of plan.scripts.entries()) {
    const descriptor=original.scripts[ordinal]!
    const common:Omit<CombinedPlanRowV3,'disposition'>={originalOrdinal:ordinal,identity:descriptor.identity,
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
    }else if(row.disposition==='prompt') {
      const compiled=prompt?.scripts[promptIndex]
      if(!descriptor.enabled||!compiled||compiled.disposition!=='compiled-prompt'
        ||compiled.ordinal!==ordinal||!same(compiled.descriptor,descriptor)
        ||compiled.descriptorSha256!==recordSha256(descriptor)
        ||!same(row,{...common,disposition:'prompt',promptIndex}))fail()
      promptIndex++
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
  if(serverIndex!==(server?.scripts.length??0)||browserIndex!==(browser?.scripts.length??0)
    ||promptIndex!==(prompt?.scripts.length??0))fail()
  if(!same(plan.summary,{enabledServerSchema:server?.executionPlan.summary.enabledServerSchema??0,
    enabledNativeLoaders:server?.executionPlan.summary.enabledNativeLoaders??0,enabledBrowser,disabled,
    enabledPrompt:promptIndex}))fail()
  const {executionPlanSha256,...planBody}=plan
  if(!hash(executionPlanSha256)||recordSha256(planBody)!==executionPlanSha256)fail()
  const {combinedProgramSha256,...body}=program
  if(recordSha256(body)!==combinedProgramSha256)fail()
  freeze(program);validatedProgramsV4.add(program)
  return program
}
export function validateCombinedAuthorProgram(input:unknown):CombinedAuthorProgram {
  if((input as {schemaVersion?:unknown})?.schemaVersion===5)return validateCombinedAuthorProgramV5(input)
  return (input as {schemaVersion?:unknown})?.schemaVersion===4
    ?validateCombinedAuthorProgramV4(input):validateCombinedAuthorProgramV3(input)
}
/** Rebuild only the tagged input envelope. The complete original Source and
 * descriptors stay with the program and are never repartitioned here. */
export function combinedCompilationInputForProgram(program:CombinedAuthorProgram):CombinedCompilationInput {
  const common={original:program.original,sourceRecordSessionId:program.sourceRecordSessionId}
  if(program.schemaVersion===5)return {schemaVersion:5,encoding:'native-author-combined-compilation-input-v5',...common}
  return program.schemaVersion===4?{schemaVersion:4,encoding:'native-author-combined-compilation-input-v4',...common}
    :{schemaVersion:3,encoding:'native-author-combined-compilation-input-v3',...common}
}
