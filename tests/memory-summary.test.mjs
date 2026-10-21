import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createMemorySummarizer, validateDetailedSummary } from '../lib/memory/memory-summary.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/memory-summary-legacy-v1.json', import.meta.url), 'utf8'))
assert.equal(fixture.schemaVersion, 1)
for (const sample of fixture.cases) {
  const before = structuredClone(sample)
  const factsOnly = sample.input.background && sample.input.appendDelta
  let calls = 0
  const signal = new AbortController().signal
  const execute = createMemorySummarizer({ get: () => ({ nativeTask: async spec => {
    calls++
    const { validate, onResult, signal: forwarded, ...rest } = spec
    const request = { ...rest, signalForwarded: forwarded === signal }
    if (sample.input.appendDelta) {
      // Append instructions now describe only the material the writer adds.
      // Keep the historical fixture for unchanged task options and results.
      const { system: oldSystem, user: oldUser, ...expectedTask } = sample.request
      const { system, user, ...actualTask } = request
      assert.deepEqual(actualTask, expectedTask, 'append mode keeps its native route, format and budget')
      for (const source of [sample.input.previousSummary, sample.input.sourceText, sample.input.lockedText]) {
        assert.ok(user.includes(source), 'append keeps complete evidence and continuity context')
      }
    } else {
      assert.deepEqual(request, sample.request, 'non-append legacy prompt bytes and native task options')
    }
    const route = { ...sample.route }
    onResult({ actualRoute: route })
    route.model = 'late mutation'
    const response = factsOnly ? { deltas: sample.response.deltas, conflicts: sample.response.conflicts } : sample.response
    return validate(response)
  } }) })
  const result = await execute({ ...sample.input, signal })
  const rendered = '- The gate opened (seq:7)'
  const expected = factsOnly ? { ...sample.result, text: rendered,
    summary: [{ type: 'text', text: rendered }], rawOutput: [{ type: 'text', text: rendered }] } : sample.result
  assert.deepEqual(result, expected, 'full legacy results or append Notes rendered from the same complete fact records')
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
  let calls = 0
  const execute = createMemorySummarizer({ get: () => ({ nativeTask: async spec => {
    calls++
    return spec.validate(response)
  } }) })
  await assert.rejects(execute(background.input), /后台记忆|正史增量|连续性记录|记忆摘要/)
  assert.equal(calls, 1, 'a refused native result cannot trigger an automatic paid retry')
}
const normal = fixture.cases[0]
for (const response of [42, {}, undefined, 'incomplete summary']) {
  await assert.rejects(createMemorySummarizer({ get: () => ({ nativeTask: async spec => spec.validate(response) }) })(normal.input), /记忆摘要/)
}
await assert.rejects(createMemorySummarizer({ get: () => null })(normal.input), /服务尚未就绪/)

let liveService = null, calls = 0
const execute = createMemorySummarizer({ get: name => { assert.equal(name, 'roleplay'); return liveService } })
await assert.rejects(execute(normal.input), /服务尚未就绪/)
liveService = { nativeTask: async spec => { calls++; return spec.validate(normal.response) } }
assert.equal((await execute(normal.input)).text, normal.response)
const failure = Object.assign(new Error('native task cancelled'), { code: 'CANCELLED' })
liveService = { nativeTask: async spec => { calls++; assert.equal(spec.signal.reason, failure); throw failure } }
const controller = new AbortController()
controller.abort(failure)
await assert.rejects(execute({ ...normal.input, signal: controller.signal }), error => error === failure)
assert.equal(calls, 2, 'reloaded service is resolved at execution time and failures are not retried')
assert.throws(() => validateDetailedSummary(normal.response, 'x'.repeat(20000), []), /过度压缩/)
assert.throws(() => validateDetailedSummary(normal.response, '', ['Absent locked fact']), /遗漏用户锁定事实/)

const agreement = { schemaVersion: 1, participants: ['Mira', 'Ren'], subject: '归还铜铃',
  conditions: ['练习结束后'], time: '明晚', place: '河边石台' }
const agreementResponse = { ...background.response,
  deltas: [{ evidenceSeq: 7, summary: 'Mira和Ren约定明晚练习结束后在河边石台归还铜铃。', status: 'established', agreement }],
  conflicts: [] }
let agreementRequests = 0
const agreements = createMemorySummarizer({ get: () => ({ nativeTask: async spec => {
  agreementRequests++
  assert.equal(spec.kind, 'memory')
  assert.equal(spec.format, 'json')
  assert.equal(spec.background, true)
  assert.match(spec.system, /人物约定要素/)
  return spec.validate(agreementResponse)
} }) }, { agreementElements: 1 })
const agreementInput = { ...background.input, sourceSeqs: [7],
  sourceText: '[叙事者 · turn:2 · seq:7]\nMira和Ren约定明晚练习结束后在河边石台归还铜铃。' }
assert.deepEqual((await agreements(agreementInput)).deltas[0].agreement, agreement)
assert.equal(agreementRequests, 1, 'agreement extraction shares the existing background task')
const proposal = 'Mira提议明晚练习结束后在河边石台归还铜铃；Ren尚未答复。'
const chronologicalText = `- [待确认] ${proposal} (seq:7)`
const appendInput = { ...agreementInput, appendDelta: true,
  sourceText: `[叙事者 · turn:2 · seq:7]\n${proposal}` }
const appendResponse = { deltas: [{ ...agreementResponse.deltas[0], summary: proposal, status: 'uncertain' }], conflicts: [] }
let appendCalls = 0
const append = createMemorySummarizer({ get: () => ({ nativeTask: async spec => {
  appendCalls++
  assert.ok(spec.user.includes(appendInput.previousSummary), 'previous notes remain complete read-only context')
  assert.ok(spec.user.includes(appendInput.sourceText), 'append keeps all new source details')
  assert.ok(spec.user.includes(appendInput.lockedText), 'locked facts remain complete read-only context')
  return spec.validate(appendResponse)
} }) }, { agreementElements: 1 })
const chronological = await append(appendInput)
assert.equal(chronological.text, chronologicalText, 'append Notes retain complete conditions, source and unconfirmed status from one fact record')
assert.deepEqual(chronological.deltas, appendResponse.deltas, 'agreement and source evidence are unchanged')
assert.equal(appendCalls, 1, 'append does not add a classification request')
for (const background of [false, true]) {
  await assert.rejects(createMemorySummarizer({ get: () => ({ nativeTask: async spec =>
    spec.validate(background ? { deltas: [], conflicts: [] } : '  ')
  }) })({ ...appendInput, background }), /摘要不能为空/)
}
const invalidAgreement = { ...agreementResponse,
  deltas: [{ ...agreementResponse.deltas[0], agreement: { ...agreement, time: [] } }] }
await assert.rejects(createMemorySummarizer({ get: () => ({ nativeTask: async spec => spec.validate(invalidAgreement) }) },
  { agreementElements: 1 })(agreementInput), /人物约定/)
console.log('memory-summary: non-append prompts, append evidence/budgets, results, native refusal, agreements, reload and cancellation passed')
