import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { apply } from '../src/core/ask-user-decision-pr.js'

let registered
const decisions = []
apply({
  get(name) { assert.equal(name, 'roleplay'); return { askDecision: async (...args) => decisions.push(args) } },
  tools: { register(tool) { registered = tool } },
})
assert.equal(registered.name, 'ask_user_decision_pr')
// Captured from the registered tool in pre-migration commit 7e6ff13.
assert.equal(createHash('sha256').update(JSON.stringify([registered])).digest('hex'), '7ab28eee78de6f6a3a65f1f4c64c4dad910d8adfb8080d75ceb4e53510c5e6c5')
assert.deepEqual(registered.parameters.required, ['questions'])
const result = await registered.execute({ questions: [{ question: '选择？', header: '抉择', options: [{ label: '留下', description: '继续', heart: true }], multi_select: true }] }, { agent: { session: { id: 'session-a', log: [1, 2] } } })
assert.equal(result.ok, true)
assert.equal(result.presented, true)
assert.deepEqual(decisions, [['session-a', { source: 'tool', seq: 2, question: '选择？', header: '抉择', options: [{ label: '留下', description: '继续', heart: true }], multiSelect: true }]])
await assert.rejects(() => registered.execute({ questions: [] }, {}), /需要在会话内使用/)
await assert.rejects(() => registered.execute({ questions: [] }, undefined), /需要在会话内使用/)
console.log('ask-user-decision-pr=ok (contract, normalization and decision publication)')
