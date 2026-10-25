import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {loadContext, parseRequest} from './quality-context.mjs'
import {makePlan} from './quality-plan.mjs'
import {executePlan, loadPrevious, printPlan} from './quality-run.mjs'

export async function qualityCli(args = process.argv.slice(2)): Promise<number> {
  const context = loadContext()
  let request = parseRequest(args)
  if (request.command === 'help') {
    const maintenance = context.audience === 'maintenance'
    const deliveryHelp = maintenance ? `npm run check -- dev --out DIRECTORY [--inputs PINNED_INPUTS]
npm run check -- build --out NEW_DIR [--inputs PINNED_INPUTS] [--foundation public|private]
npm run check -- build --refresh-from ACCEPTED_PUBLIC_CANDIDATE --out NEW_DIR
npm run check -- release --bundle CANDIDATE [--upgrade-from OLD_TGZ --upgrade-sha256 SHA]
npm run check -- installer windows|linux --bundle CANDIDATE --out NEW_DIR
npm run check -- harness --bundle CANDIDATE` : 'npm run check -- release'
    console.log(`npm run check -- [changed|file PATH...|module ID...|syntax PATH...|types [PATH...]] [--plan] [--force]
npm run check -- tests | task ID...${maintenance ? ' | mechanics' : ''}
${deliveryHelp}
npm run check -- resume [--run artifacts/checks/RUN_ID.json] [--force] [--plan]
npm run check -- list
Default: current Git changes only. --base REF selects changes since a CI/base commit.
No Git: select file/module/category explicitly. --portable describes capabilities, never selects all tests.
types uses the real strict project configuration without writes. generated gates strict types and stale JS together.
${maintenance ? 'dev, ' : ''}build, mechanics, installer, release and harness are independent explicit purposes, not automatic escalation.
Public task lists omit private facilities and tasks with unavailable prerequisites. Unknown task requests end nonzero.
Checks do not format or repair sources. Records are local under artifacts/checks/.`)
    return 0
  }
  if (request.command === 'list') {
    for (const module of context.registry.modules) console.log(module.id + ': ' + module.aliases.join(' / '))
    for (const task of context.registry.tasks) console.log(task.id + (task.heavy ? ' [explicit/heavy]' : '')
      + (task.unavailable ? ' [unsupported: ' + task.unavailable + ']' : ''))
    return 0
  }
  if (request.command === 'resume') {
    const previous = loadPrevious(context, request.run)
    if (!previous) throw Error('No previous run; choose a scope first')
    request = {...previous.request, force: request.force, plan: request.plan, run: request.run}
  }
  const plan = makePlan(context, request)
  printPlan(context, plan)
  if (request.plan) return plan.uncovered.length ? 2 : 0
  if (!plan.tasks.length) return plan.uncovered.length ? 2 : 0
  const run = await executePlan(context, plan, {previous: loadPrevious(context, request.run)})
  return run.status === 'passed' ? 0 : run.status === 'interrupted' ? 130 : 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {process.exitCode = await qualityCli()}
  catch (error) {console.error(error instanceof Error ? error.message : error); process.exitCode = 2}
}
