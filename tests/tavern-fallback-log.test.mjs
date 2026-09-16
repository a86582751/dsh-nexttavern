import assert from 'node:assert/strict'
import { createTavernTasks, InlinePending, taskFailureDetails } from '../src/core/tavern-tasks.js'
import { createTelemetry } from '../src/core/tavern-telemetry.js'
import { formatFallbackText } from '../src/client.js'

class Table extends Map { async put(key, value) { this.set(key, structuredClone(value)) } }

const main = { provider: 'main-provider', model: 'main-model' }
const alternate = { provider: 'first-provider', model: 'first-model' }
const session = { id: 'fallback-log-fixture', header: { agentPreset: 'roleplay' } }
const agent = { options: main }
const cases = [
  ['timeout', { code: 'TASK_TIMEOUT' }],
  ['truncated', { kind: 'max-tokens' }],
  ['empty-response', { code: 'EMPTY_TASK_RESULT' }],
  ['empty-response', { code: 'EMPTY_RESPONSE' }],
  ['authentication', { status: 401, code: 'INVALID_API_KEY' }],
  ['balance', { status: 402, code: 'INSUFFICIENT_BALANCE' }],
  ['quota', { code: 'INSUFFICIENT_QUOTA' }],
  ['rate-limit', { status: 429, code: 'RATE_LIMIT' }],
  ['request-header', { code: 'INVALID_HEADER' }],
  ['invalid-request', { status: 400, code: 'BAD_REQUEST' }],
  ['overloaded', {code:'PI_AI_ERROR',message:'Our servers are currently overloaded. Please try again later.'}],
  ['unknown', { code: 'UNRECOGNIZED_FAILURE' }],
]

for (const [expectedCategory, failure] of cases) {
  assert.equal(taskFailureDetails(failure).category, expectedCategory, `${expectedCategory} classifier fixture`)
  const table = new Table()
  const policy = { resolve: async () => ({ execution: 'spawn', actualRoute: alternate, main }) }
  const subagents = {
    async start() { throw Object.assign(new Error('fixture child failure'), { failure }) },
  }
  const tasks = createTavernTasks({ table, policy, subagents })
  await assert.rejects(
    tasks.request({ session, agent, kind: 'status', source: { fixture: expectedCategory }, input: { system: 'fixture', user: 'fixture' } }),
    InlinePending,
  )
  const job = tasks.list(session)[0]
  assert.equal(job.execution, 'inline')
  assert.deepEqual(job.fallback.from, alternate, `${expectedCategory} keeps the first model`)
  assert.deepEqual(job.fallback.to, main, `${expectedCategory} keeps the fallback model`)
  assert.equal(job.fallback.failure.category, expectedCategory)
  assert.equal(job.fallback.failure.label, taskFailureDetails(failure).label)

  const telemetry = createTelemetry({ table: new Table(), sessions: { get: () => null, list: () => [] }, jobs: () => [job] })
  const row = telemetry.logs().find(item => item.id === `job-${job.id}`)
  assert.ok(row, `${expectedCategory} has a public task log`)
  assert.deepEqual(row.fallback.from, alternate)
  assert.deepEqual(row.fallback.to, main)
  assert.equal(row.fallback.failure.category, expectedCategory)
  assert.equal(row.fallback.failure.label, taskFailureDetails(failure).label)
  assert.ok(!JSON.stringify(row).includes('fixture child failure'), 'public logs do not expose raw failure text')
  const publicText = formatFallbackText(row.fallback)
  assert.match(publicText, /first-provider first-model.*main-provider main-model/, 'public text keeps both model routes')
  assert.match(publicText, expectedCategory === 'unknown' ? /失败（原因未提供）/ : new RegExp(row.fallback.failure.label), 'public text reports the classified reason without guessing unknown')
}

console.log('tavern-fallback-log=ok (classified fallback provenance and public redaction)')
