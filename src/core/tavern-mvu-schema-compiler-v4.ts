/** New v4 controller. Data preparation only; no publication/0REG authority.
 * Parsing/binding/transpilation stays in a disposable deadline-bound worker. */
import {Worker} from 'node:worker_threads'
import {recordSha256} from './roleplay-data.js'
import {MVU_SCHEMA_BOUNDS} from './tavern-mvu-schema-types.js'
import {validateSchemaProgramV4, validateSchemaCompilationInputV4, validateSchemaCompilerIdentityV4,
  validateSchemaCompiledCodeV4}
  from './tavern-mvu-schema-program-v4.js'
import type {CompilationV4, CompilerDepsV4, MvuSchemaCompilerV4,
  MvuSchemaCompilationInputV4, MvuSchemaProgramV4, SchemaCompilationCodeV4}
  from './tavern-mvu-schema-program-v4.js'
import type {MvuSchemaDiagnostic} from './tavern-mvu-schema-types.js'

const same = (a: unknown, b: unknown) => recordSha256(a) === recordSha256(b)
const refused = (code: string): CompilationV4 => ({kind: 'refused', diagnostics: [{code}]})
function diagnostic(input: unknown): MvuSchemaDiagnostic {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('diagnostic')
  const value = input as Record<string, unknown>
  if (typeof value.code !== 'string' || !/^[A-Z0-9_]{1,128}$/.test(value.code)
    || Object.keys(value).some(key => !['code', 'pointer', 'scriptIdentity', 'line', 'column'].includes(key))
    || value.pointer !== undefined && (typeof value.pointer !== 'string' || Buffer.byteLength(value.pointer, 'utf8') > 4096)
    || value.scriptIdentity !== undefined && (typeof value.scriptIdentity !== 'string'
      || Buffer.byteLength(value.scriptIdentity, 'utf8') > 256)
    || value.line !== undefined && (!Number.isSafeInteger(value.line) || Number(value.line) < 1)
    || value.column !== undefined && (!Number.isSafeInteger(value.column) || Number(value.column) < 1)) throw Error('diagnostic')
  return value as unknown as MvuSchemaDiagnostic
}
function inputOf(program: MvuSchemaProgramV4, expectedPlan: MvuSchemaCompilationInputV4['executionPlan']): MvuSchemaCompilationInputV4 {
  return {schemaVersion: 2, encoding: 'native-mvu-author-compilation-input-v2', source: program.source,
    scripts: program.scripts.map(({javascript: _javascript, javascriptSha256: _javascriptSha256, ...script}) => script),
    libraries: program.libraries, bridge: program.bridge, stateLoader: program.stateLoader, executionPlan: expectedPlan}
}
export function createMvuSchemaCompilerV4(deps: CompilerDepsV4): MvuSchemaCompilerV4 {
  const identity = validateSchemaCompilerIdentityV4(deps.identity)
  const workerUrl = new URL(deps.workerUrl ?? new URL('./tavern-mvu-schema-compiler-worker-v4.mjs', import.meta.url))
  if (workerUrl.protocol !== 'file:') throw Error('MVU_SCHEMA_COMPILER_WORKER_URL_INVALID')
  let live = true, disposing: Promise<void> | undefined
  const active = new Set<{cancel(code: string): void; done: Promise<CompilationV4>}>()
  async function compile(raw: MvuSchemaCompilationInputV4, signal?: AbortSignal): Promise<CompilationV4> {
    if (!live) return refused('MVU_SCHEMA_COMPILER_DISPOSED')
    if (signal?.aborted) return refused('MVU_SCHEMA_COMPILER_CANCELLED')
    if (active.size >= 4) return refused('MVU_SCHEMA_COMPILER_BUSY')
    let input: MvuSchemaCompilationInputV4
    try {input = validateSchemaCompilationInputV4(raw)}
    catch {return refused('MVU_SCHEMA_COMPILER_INPUT_INVALID')}
    if (!live) return refused('MVU_SCHEMA_COMPILER_DISPOSED')
    if (signal?.aborted) return refused('MVU_SCHEMA_COMPILER_CANCELLED')
    // The worker owns code admission only. Its message does not transport the
    // complete author material that this immutable Host input already owns.
    const codeInput:SchemaCompilationCodeV4={scripts:input.scripts,libraries:input.libraries,
      bridge:input.bridge,stateLoader:input.stateLoader,executionPlan:input.executionPlan}
    let worker: Worker
    try {
      worker = new Worker(workerUrl, {workerData: {identity, input:codeInput}, resourceLimits: {
        maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16, stackSizeMb: 2,
      }})
    } catch {return refused('MVU_SCHEMA_COMPILER_WORKER_UNAVAILABLE')}
    const completion = Promise.withResolvers<CompilationV4>()
    let settled = false
    const abort = () => job.cancel('MVU_SCHEMA_COMPILER_CANCELLED')
    const timer = setTimeout(() => job.cancel('MVU_SCHEMA_COMPILER_DEADLINE'), MVU_SCHEMA_BOUNDS.parentDeadlineMs)
    const finish = (result: CompilationV4) => {
      if (settled) return
      settled = true
      clearTimeout(timer);signal?.removeEventListener('abort', abort)
      // Resolve after termination. Disposal/cancel revokes an already received
      // result and cannot leak a late program while callers release resources.
      void worker.terminate().then(() => completion.resolve(!live ? refused('MVU_SCHEMA_COMPILER_DISPOSED')
        : signal?.aborted ? refused('MVU_SCHEMA_COMPILER_CANCELLED') : result),
      () => completion.resolve(refused('MVU_SCHEMA_COMPILER_CLEANUP'))).finally(() => active.delete(job))
    }
    const job = {cancel: (code: string) => finish(refused(code)), done: completion.promise}
    active.add(job)
    worker.once('error', () => finish(refused('MVU_SCHEMA_COMPILER_WORKER_ERROR')))
    worker.once('exit', () => {if (!settled) finish(refused('MVU_SCHEMA_COMPILER_WORKER_EXIT'))})
    worker.once('message', (rawResult: unknown) => {
      if (settled) return
      if (!live) {job.cancel('MVU_SCHEMA_COMPILER_DISPOSED');return}
      if (signal?.aborted) {abort();return}
      try {
        const result = rawResult as Record<string, unknown>
        if (!result || typeof result !== 'object' || Array.isArray(result)) throw Error('result')
        if (result.kind === 'compiled' && Object.keys(result).sort().join(',') === 'code,kind') {
          const code = validateSchemaCompiledCodeV4(result.code)
          const {compiler:_compiler,...compiledInput}=code
          const restoredInput={...compiledInput,executionPlan:input.executionPlan,
            scripts:code.scripts.map(({javascript:_javascript,javascriptSha256:_javascriptSha256,...script})=>script)}
          if (!same(code.compiler, identity) || !same(restoredInput, codeInput)) {
            throw Error('result identity')
          }
          // A non-null expected plan can only be accepted after the trusted
          // worker recomputed it. Parent metadata equality adds a second guard.
          if (input.executionPlan !== null && !same(input.executionPlan, code.executionPlan)) throw Error('expected plan')
          // The durable schema and logical hashes still contain the complete
          // original Source. No worker placeholder or replacement Source exists.
          const descriptor={schemaVersion:2 as const,encoding:'native-mvu-author-schema-program-v2' as const,
            compiler:code.compiler,source:input.source,bridge:code.bridge,stateLoader:code.stateLoader,
            libraries:code.libraries,scripts:code.scripts,executionPlan:code.executionPlan}
          const program=validateSchemaProgramV4({...descriptor,programSha256:recordSha256(descriptor)})
          finish({kind: 'compiled', program})
        } else if (result.kind === 'refused' && Object.keys(result).sort().join(',') === 'diagnostics,kind'
          && Array.isArray(result.diagnostics) && result.diagnostics.length === 1) {
          finish({kind: 'refused', diagnostics: [diagnostic(result.diagnostics[0])]})
        } else throw Error('result shape')
      } catch {finish(refused('MVU_SCHEMA_COMPILER_RESULT_INVALID'))}
    })
    signal?.addEventListener('abort', abort, {once: true})
    if (signal?.aborted) abort()
    if (!live) job.cancel('MVU_SCHEMA_COMPILER_DISPOSED')
    return completion.promise
  }
  async function verifyProgram(raw: MvuSchemaProgramV4, signal?: AbortSignal): Promise<boolean> {
    if (!live || signal?.aborted) return false
    try {
      const program = validateSchemaProgramV4(raw)
      if (!same(program.compiler, identity)) return false
      const result = await compile(inputOf(program, program.executionPlan), signal)
      return live && !signal?.aborted && result.kind === 'compiled' && same(result.program, program)
    } catch {return false}
  }
  return {identity, compile, verifyProgram, async dispose() {
    if (disposing) return disposing
    live = false
    const jobs = [...active]
    for (const job of jobs) job.cancel('MVU_SCHEMA_COMPILER_DISPOSED')
    disposing = Promise.all(jobs.map(job => job.done)).then(() => {})
    return disposing
  }}
}
