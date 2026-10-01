import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createMemorySummarizer, validateDetailedSummary } from '../lib/memory/memory-summary.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/memory-summary-legacy-v1.json', import.meta.url), 'utf8'))
assert.equal(fixture.schemaVersion, 1)
for (const sample of fixture.cases) {
  const before = structuredClone(sample)
  let calls = 0
  const signal = new AbortController().signal
  const execute = createMemorySummarizer({ get: () => ({ nativeTask: async spec => {
    calls++
    const { validate, onResult, signal: forwarded, ...rest } = spec
    assert.deepEqual({ ...rest, signalForwarded: forwarded === signal }, sample.request, 'legacy prompt bytes and native task options')
    const route = { ...sample.route }
    onResult({ actualRoute: route })
    route.model = 'late mutation'
    return validate(sample.response)
  } }) })
  const result = await execute({ ...sample.input, signal })
  assert.deepEqual(result, sample.result, 'legacy text, raw output, deltas, conflicts and route')
  assert.strictEqual(result.summary, result.rawOutput)
  assert.equal(calls, 1, 'one native task request per execution')
  assert.deepEqual(sample, before, 'no mutation of input or returned service data')
}

const background = fixture.cases.find(sample => sample.input.background)
const invalid = [null, 0, 'text', {}, { ...background.response, deltas: {} },
  { ...background.response, deltas: [{ evidenceSeq: 99, summary: 'foreign', status: 'established' }] },
  { ...background.response, deltas: [{ evidenceSeq: '7', summary: 'coerced', status: 'established' }] },
  { ...background.response, deltas: [{ evidenceSeq: 7, summary: 'unknown', status: 'invalid' }] },
  { ...background.response, conflicts: [{ evidenceSeq: 99, claim: 'foreign', canon: 'old', severity: 'low' }] },
  { ...background.response, conflicts: [{ evidenceSeq: 7, claim: 'bad', canon: 'old', severity: 'urgent' }] },
  { ...background.response, text: 'missing eight sections' }]
for (const response of invalid) {
  for (const honorValidator of [false, true]) {
    let calls = 0
    const execute = createMemorySummarizer({ get: () => ({ nativeTask: async spec => {
      calls++
      return honorValidator ? spec.validate(response) : response
    } }) })
    await assert.rejects(execute(background.input), /后台记忆|正史增量|连续性记录|记忆摘要/)
    assert.equal(calls, 1, 'bad returned data cannot trigger an automatic paid retry')
  }
}
const normal = fixture.cases[0]
for (const response of [42, {}, undefined, 'incomplete summary']) {
  await assert.rejects(createMemorySummarizer({ get: () => ({ nativeTask: async () => response }) })(normal.input), /记忆摘要/)
}
await assert.rejects(createMemorySummarizer({ get: () => null })(normal.input), /服务尚未就绪/)

let liveService = null, calls = 0
const execute = createMemorySummarizer({ get: name => { assert.equal(name, 'roleplay'); return liveService } })
await assert.rejects(execute(normal.input), /服务尚未就绪/)
liveService = { nativeTask: async () => { calls++; return normal.response } }
assert.equal((await execute(normal.input)).text, normal.response)
const failure = Object.assign(new Error('native task cancelled'), { code: 'CANCELLED' })
liveService = { nativeTask: async spec => { calls++; assert.equal(spec.signal.reason, failure); throw failure } }
const controller = new AbortController()
controller.abort(failure)
await assert.rejects(execute({ ...normal.input, signal: controller.signal }), error => error === failure)
assert.equal(calls, 2, 'reloaded service is resolved at execution time and failures are not retried')
await assert.rejects(createMemorySummarizer({ get: () => ({ nativeTask: async spec => {
  spec.onResult({ actualRoute: 'malformed' })
  return normal.response
} }) })(normal.input), /路由无效/)
assert.throws(() => validateDetailedSummary(normal.response, 'x'.repeat(20000), []), /过度压缩/)
assert.throws(() => validateDetailedSummary(normal.response, '', ['Absent locked fact']), /遗漏用户锁定事实/)
console.log('memory-summary: legacy prompt bytes/results, one native task, malformed returned data, source fences, reload and cancellation passed')
