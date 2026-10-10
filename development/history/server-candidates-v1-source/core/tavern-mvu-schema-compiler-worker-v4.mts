/** Bounded owned v4 worker. Neither author nor upstream helper is evaluated. */
import {parentPort, workerData} from 'node:worker_threads'
import ts from 'typescript'
import {recordSha256} from './roleplay-data.js'
import {schemaTextSha256} from './tavern-mvu-schema-data.js'
import {createAuthorExecutionPlannerV1}
  from './tavern-mvu-author-execution-classifier-v4.mjs'
import {compileSchemaAstV4, hasRegistrationIntentV4, SchemaAstRefusalV4} from './tavern-mvu-schema-compiler-ast-v4.js'
import {validateSchemaCompilationCodeV4, validateSchemaCompiledCodeV4, validateSchemaCompilerIdentityV4}
  from './tavern-mvu-schema-program-v4.js'
import type {CompilationCodeV4, ServerCandidateCodePartitionV4} from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaDiagnostic} from './tavern-mvu-schema-types.js'
import type {WorkerOwnedSchemaAstAdmission,AuthorExecutionPlanV1,RegisteredCommandPolicyBindingV1,
  InitializationWriteBindingV1, ExecutionPlanScriptV1}
  from './tavern-mvu-author-execution-types-v4.mjs'

const same = (a: unknown, b: unknown) => recordSha256(a) === recordSha256(b)
class WorkerRefusalV4 extends Error {
  constructor(readonly diagnostic: MvuSchemaDiagnostic) {super(diagnostic.code)}
}
function compile(): CompilationCodeV4 | ServerCandidateCodePartitionV4 {
  if (ts.version !== '5.9.3') throw Error('MVU_SCHEMA_TYPESCRIPT_VERSION')
  const message = workerData as Record<string, unknown>
  if (!message || typeof message !== 'object' || Array.isArray(message)
    || !(Object.keys(message).sort().join(',') === 'identity,input'
      || Object.keys(message).sort().join(',') === 'identity,input,operation' && message.operation === 'partition')) {
    throw Error('MVU_SCHEMA_V4_WORKER_MESSAGE')
  }
  const partition = message.operation === 'partition'
  const identity = validateSchemaCompilerIdentityV4(message.identity)
  const input = validateSchemaCompilationCodeV4(message.input)
  if (partition && input.executionPlan !== null) throw Error('MVU_SCHEMA_V4_CANDIDATE_EXPECTED_PLAN_FORBIDDEN')
  const compiledByIdentity = new Map<string, {rawDescriptorSha256: string; javascript: string;
    commandPolicyBindings:readonly RegisteredCommandPolicyBindingV1[];
    initializationWriteBindings:readonly InitializationWriteBindingV1[]}>()
  const schemaDiagnostics = new Map<string, MvuSchemaDiagnostic>()
  // This closure is constructed inside the trusted worker. No admission result
  // is serialized into workerData, accepted from an author, or borrowed from
  // the caller's expected historical plan. It runs the full canonical gates.
  const admitSchemaAst: WorkerOwnedSchemaAstAdmission = ({script, sourceFile, checker,ordinal}) => {
    try {
      if (partition && !hasRegistrationIntentV4(script, sourceFile, checker)) {
        return {kind: 'not-schema', diagnosticCodes: ['MVU_SCHEMA_REGISTRATION_INTENT_MISSING']}
      }
      const result = compileSchemaAstV4(script, input, sourceFile, checker,ordinal)
      if (result.kind !== 'schema') return {kind: 'not-schema', diagnosticCodes: ['MVU_SCHEMA_REGISTRATION_INTENT_MISSING']}
      compiledByIdentity.set(script.identity, {rawDescriptorSha256: recordSha256(script), javascript: result.javascript,
        commandPolicyBindings:result.commandPolicyBindings,initializationWriteBindings:result.initializationWriteBindings})
      return {kind: 'accepted-schema', admittedSourceSha256: script.sourceSha256,
        statementSpans: sourceFile.statements.map(node => ({start: node.getFullStart(), end: node.end}))}
    } catch (error) {
      const diagnostic = error instanceof SchemaAstRefusalV4 ? error.diagnostic
        : {code: error instanceof RangeError ? 'MVU_SCHEMA_SYNTAX_DEPTH_LIMIT' : 'MVU_SCHEMA_V4_AST_UNAVAILABLE'}
      schemaDiagnostics.set(script.identity, diagnostic)
      return {kind: 'refused', diagnosticCodes: [diagnostic.code]}
    }
  }
  const planner = createAuthorExecutionPlannerV1({
    stateLoaderImplementation: {...input.stateLoader, version: 4}, admitSchemaAst,
  })
  const serverOrdinals: number[] = [], serverRows: ExecutionPlanScriptV1[] = []
  if (partition) {
    for (const [originalOrdinal, script] of input.scripts.entries()) {
      if (!script.enabled) continue
      // Accepted output is emitted with its final server-local ordinal. Browser
      // gaps never require a second parse or a second compile of accepted JS.
      const row = planner.classifyCandidate(script, serverRows.length)
      if (row.classification === 'server-schema' || row.classification === 'native-state-loader') {
        serverOrdinals.push(originalOrdinal);serverRows.push(row)
      } else if (row.diagnosticCodes[0] !== 'MVU_SCHEMA_REGISTRATION_INTENT_MISSING') {
        throw new WorkerRefusalV4(schemaDiagnostics.get(script.identity) ?? {
          code: row.diagnosticCodes[0] ?? 'MVU_SCHEMA_V4_COMPLETE_SHAPE_UNSUPPORTED',
          scriptIdentity: script.identity, pointer: script.pointer,
        })
      }
    }
    if (!serverOrdinals.length) return {kind: 'partitioned', serverOrdinals, code: null}
  }
  const selectedScripts = partition ? serverOrdinals.map(ordinal => input.scripts[ordinal]!) : input.scripts
  const classified = partition ? planner.assemblePlan(serverRows) : planner.plan(input.scripts)
  const profileBody={schemaVersion:1 as const,encoding:'native-mvu-registered-command-policy-profile-v1' as const,
    errorPolicy:'registered-command-policy-v1' as const,
    bindings:selectedScripts.flatMap(script=>compiledByIdentity.get(script.identity)?.commandPolicyBindings??[])}
  const commandPolicyProfile={...profileBody,profileSha256:recordSha256(profileBody)}
  const initializationWriteBindings=selectedScripts.flatMap(script=>
    compiledByIdentity.get(script.identity)?.initializationWriteBindings??[])
  const initializationWriteBody={schemaVersion:1 as const,
    encoding:'native-mvu-chat-initialization-write-profile-v1' as const,bindings:initializationWriteBindings}
  const {executionPlanSha256:_priorPlan,...classifiedBody}=classified
  const planBody={...classifiedBody,commandPolicyProfile,...initializationWriteBindings.length
    ?{initializationWriteProfile:{...initializationWriteBody,profileSha256:recordSha256(initializationWriteBody)}}:{}}
  const executionPlan:AuthorExecutionPlanV1={...planBody,executionPlanSha256:recordSha256(planBody)}
  const unsupported = executionPlan.scripts.find(row => row.enabled && row.classification === 'unsupported')
  if (unsupported) throw new WorkerRefusalV4(schemaDiagnostics.get(unsupported.identity) ?? {
    code: unsupported.diagnosticCodes[0] ?? 'MVU_SCHEMA_V4_COMPLETE_SHAPE_UNSUPPORTED',
    scriptIdentity: unsupported.identity, pointer: unsupported.pointer,
  })
  if (input.executionPlan !== null && !same(input.executionPlan, executionPlan)) {
    throw Error('MVU_SCHEMA_V4_EXPECTED_PLAN_MISMATCH')
  }
  const scripts = selectedScripts.map((script, ordinal) => {
    const row = executionPlan.scripts[ordinal]
    if (!row || row.identity !== script.identity || row.rawDescriptorSha256 !== recordSha256(script)) {
      throw Error('MVU_SCHEMA_V4_RAW_SCRIPT_REFERENCE')
    }
    let javascript = ''
    if (row.classification === 'server-schema') {
      const compiled = compiledByIdentity.get(script.identity)
      if (!compiled || compiled.rawDescriptorSha256 !== row.rawDescriptorSha256) {
        throw Error('MVU_SCHEMA_V4_SCHEMA_AST_ADMISSION_MISSING')
      }
      javascript = compiled.javascript
    }
    // Native loaders contribute only complete AST resolution proof. Their raw
    // URL arrays/try/catch/logs remain in Source, but no original loader JS runs.
    return {...script, javascript, javascriptSha256: schemaTextSha256(javascript)}
  })
  const code = {compiler: identity, bridge: input.bridge, stateLoader: input.stateLoader,
    libraries: input.libraries, scripts, executionPlan}
  const compiledCode = validateSchemaCompiledCodeV4(code)
  return partition ? {kind: 'partitioned', serverOrdinals, code: compiledCode} : {kind: 'compiled', code: compiledCode}
}
try {parentPort?.postMessage(compile())}
catch (error) {
  const diagnostic = error instanceof WorkerRefusalV4 ? error.diagnostic
    : {code: error instanceof Error && /^[A-Z0-9_]{1,128}$/.test(error.message)
      ? error.message : 'MVU_SCHEMA_V4_COMPILER_INPUT_INVALID'}
  parentPort?.postMessage({kind: 'refused', diagnostics: [diagnostic]} satisfies CompilationCodeV4)
}
