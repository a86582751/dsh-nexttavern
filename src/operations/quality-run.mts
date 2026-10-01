import fs from 'node:fs'
import path from 'node:path'
import {createHash, randomUUID} from 'node:crypto'
import {readJson} from './quality-context.mjs'
import {fingerprint} from './quality-inputs.mjs'
import {capabilityProblem} from './quality-process.mjs'
import {executeTask} from './quality-actions.mjs'
import type {ActionOptions} from './quality-actions.mjs'
import type {CheckContext, CheckPlan, CheckRun, CheckTask, TaskResult} from './quality-types.mjs'
import type {ProcessResult} from './quality-process.mjs'

export function loadPrevious(context: CheckContext, requested?: string): CheckRun | null {
  const file = requested ? path.resolve(context.root, requested) : path.join(context.stateDirectory, 'latest.json')
  if (!fs.existsSync(file)) {
    if (requested) throw Error('No check run at ' + file)
    return null
  }
  const record = readJson<CheckRun>(file)
  if (record.schemaVersion !== 1 || record.root !== context.root) throw Error('Check run belongs to a different package or schema')
  return record
}

export function printPlan(context: CheckContext, plan: CheckPlan): void {
  const brief = (items: string[], limit = 3) => items.slice(0, limit).join('; ') + (items.length > limit ? '; +' + (items.length - limit) + ' more' : '')
  console.log('check plan [' + context.audience + ']: ' + (plan.request.command || 'changed'))
  if (plan.files.length) console.log('files: ' + brief(plan.files, 6))
  for (const task of plan.tasks) {
    const effects = task.effects ?? {}
    console.log('- ' + task.id + ': ' + brief([...new Set(plan.reasons[task.id])])
      + ' [build=' + !!effects.build + ', network=' + !!effects.network + ', service=' + !!effects.service + ']'
      + ((task.requires?.length ?? 0) ? ' requires=' + task.requires!.join(',') : '')
      + (task.unavailable ? ' UNSUPPORTED: ' + task.unavailable : ''))
  }
  for (const warning of plan.uncovered) console.log('UNCOVERED: ' + warning)
  for (const notice of plan.notice) console.log(notice)
}

export async function executePlan(context: CheckContext, plan: CheckPlan, options: {
  previous?: CheckRun | null
  execute?: (context: CheckContext, plan: CheckPlan, task: CheckTask, options: ActionOptions) => Promise<ProcessResult>
  capability?: (context: CheckContext, task: CheckTask) => string | null
  signal?: AbortSignal
} = {}): Promise<CheckRun> {
  const previous = options.previous ?? loadPrevious(context)
  const run: CheckRun = {schemaVersion: 1, root: context.root, id: randomUUID(), request: plan.request,
    files: plan.files, status: 'running', results: [], successes: {...previous?.successes}}
  fs.mkdirSync(context.stateDirectory, {recursive: true})
  const checkpoint = () => {
    const text = JSON.stringify(run, null, 2) + '\n'
    for (const name of [run.id + '.json', 'latest.json']) {
      const file = path.join(context.stateDirectory, name), temporary = file + '.' + run.id + '.tmp'
      fs.writeFileSync(temporary, text); fs.renameSync(temporary, file)
    }
  }
  const tempRoot = path.resolve(context.root, 'artifacts/test-temp')
  if (context.audience === 'maintenance' && process.platform === 'win32' && /^c:/i.test(tempRoot)) throw Error('Maintenance temporary storage must stay on D:')
  fs.mkdirSync(tempRoot, {recursive: true})
  const temporary = fs.mkdtempSync(path.join(tempRoot, 'quality-'))
  const controller = new AbortController()
  const interrupt = () => controller.abort()
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt)
  options.signal?.addEventListener('abort', interrupt, {once: true})
  if (options.signal?.aborted) controller.abort()
  checkpoint()
  try {
    for (const task of plan.tasks) {
      if (controller.signal.aborted) {run.status = 'interrupted'; break}
      const started = Date.now()
      const result: TaskResult = {id: task.id, status: 'running', ms: 0}
      run.results.push(result)
      const blocked = (task.depends ?? []).find(id => !run.results.some(result => result.id === id && ['passed', 'reused'].includes(result.status)))
      if (blocked) {result.status = 'blocked'; result.reason = 'prerequisite ' + blocked; checkpoint(); continue}
      let unavailable: string | null
      try {unavailable = (options.capability ?? capabilityProblem)(context, task)}
      catch (error) {unavailable = error instanceof Error ? error.message : String(error)}
      if (unavailable) {result.status = 'unsupported'; result.reason = unavailable; checkpoint(); continue}
      try {
        const taskKey = () => {
          const prerequisites = (task.depends ?? []).map(id => {
            const prerequisite = plan.tasks.find(item => item.id === id)!
            // A gate only proves current inputs are admissible; it produces no
            // consumed artifact. Its definition changes invalidate dependents,
            // while unrelated project source changes do not erase scoped wins.
            return [id, prerequisite.gate ? prerequisite : run.results.find(result => result.id === id)?.fingerprint]
          })
          return createHash('sha256').update(fingerprint(context, plan, task))
            .update(JSON.stringify(prerequisites)).digest('hex')
        }
        const key = taskKey()
        result.fingerprint = key
        if (!plan.request.force && task.cache !== false && run.successes[task.id]?.fingerprint === key) {
          result.status = 'reused'; result.ms = 0; console.log('reused ' + task.id); checkpoint(); continue
        }
        // Persist before starting a child. Abrupt parent termination leaves a
        // running record and no cached success for that unfinished invocation.
        delete run.successes[task.id]; checkpoint()
        console.log('run ' + task.id)
        const executed = await (options.execute ?? executeTask)(context, plan, task, {temporary, signal: controller.signal})
        result.status = executed.interrupted ? 'interrupted' : executed.timedOut ? 'timed-out' : executed.status ? 'failed' : 'passed'
        result.ms = Date.now() - started
        if (result.status === 'passed') {
          if (taskKey() !== key) throw Error('Task inputs changed during execution; no success reused')
          if (task.cache !== false) run.successes[task.id] = {fingerprint: key, ms: result.ms}
        }
      } catch (error) {
        result.status = 'failed'; result.reason = error instanceof Error ? error.message : String(error)
        delete run.successes[task.id]
      }
      result.ms = Date.now() - started
      console.log(result.status + ' ' + task.id + ' (' + result.ms + 'ms)' + (result.reason ? ': ' + result.reason : ''))
      checkpoint()
    }
    run.status = controller.signal.aborted ? 'interrupted' : plan.uncovered.length ? 'uncovered'
      : run.results.every(result => ['passed', 'reused'].includes(result.status)) ? 'passed' : 'failed'
    checkpoint()
    console.log('check=' + run.status + '; record=' + path.relative(context.root, path.join(context.stateDirectory, run.id + '.json')))
    for (const result of run.results.filter(result => !['passed', 'reused'].includes(result.status))) console.log(result.status + ': ' + result.id + ' ' + (result.reason ?? ''))
    return run
  } finally {
    process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt)
    options.signal?.removeEventListener('abort', interrupt)
    if (path.dirname(temporary) !== tempRoot || fs.lstatSync(temporary).isSymbolicLink()) throw Error('Temporary directory ownership changed')
    fs.rmSync(temporary, {recursive: true, force: true, maxRetries: 3, retryDelay: 100})
  }
}
