import assert from 'node:assert/strict'
import { createTelemetry } from '../src/core/tavern-telemetry.ts'
import { resolvePricing } from '../src/core/tavern-pricing.ts'
import { aggregateUsage } from '../src/core/tavern-telemetry-aggregate.ts'
import { queryUsageRequests } from '../src/core/tavern-telemetry-query.ts'

class Table extends Map { async put(key, value) { this.set(key, structuredClone(value)) } }
const call = {
  schemaVersion: 1, id: 'embedding-1', ownerSessionId: null, workspaceId: 'ws-a',
  provider: 'local', model: 'bge-m3', purpose: 'query', startedAt: 100, completedAt: 140,
  status: 'completed', inputTokens: 12, totalTokens: 12,
  providerUsage: { prompt_tokens: 12, output_tokens: 3 }, requestId: 'req-a',
}
const table = new Table()
const telemetry = createTelemetry({ table, sessions: { get: () => null, list: () => [] }, jobs: () => [] })
const pending = await telemetry.recordEmbedding({ ...call, status: 'unknown', inputTokens: null, totalTokens: null, providerUsage: {} })
assert.equal(pending.status, 'unknown')
const first = await telemetry.recordEmbedding(call)
const second = await telemetry.recordEmbedding(call)
assert.equal(first.id, 'embedding-1')
assert.equal(first.status, 'completed', 'unknown calls accept the later terminal result')
assert.equal(first.usage.inputTokens, 12, 'late terminal usage replaces unknown usage')
assert.equal(second.id, first.id, 'duplicate terminal results are idempotent')
assert.equal(telemetry.calls().length, 1)
assert.equal(first.ownerSessionId, null, 'workspace-level embeddings retain null owner')
assert.equal(first.source.kind, 'embedding')
assert.equal(first.source.purpose, 'query')
assert.equal(first.providerUsage.output_tokens, 3, 'vendor usage remains separate from priced output')
assert.equal(resolvePricing(first, { currency: 'USD', rates: [{ provider: 'local', model: 'bge-m3', input: 1 }] }).cost, 0.000012, 'input-only pricing does not require output/cache rates')
assert.equal(aggregateUsage([first], { from: 0, to: 1000 }).totals.calls, 1)
assert.equal(aggregateUsage([first, { ...first, id: 'other', kind: 'narrative' }], { from: 0, to: 1000, kind: 'embedding' }).totals.calls, 1, 'kind filter isolates embeddings')
assert.equal(queryUsageRequests([first], { from: 0, to: 1000 }).total, 1, 'null-owner workspace calls remain queryable')
await assert.rejects(() => telemetry.recordEmbedding({ ...call, status: 'unknown', inputTokens: null, totalTokens: null }), /rollback/)
await assert.rejects(() => telemetry.recordEmbedding({ ...call, provider: 'other' }), /identity/)
await assert.rejects(() => telemetry.recordEmbedding({ ...call, id: '', ownerSessionId: 'unknown' }), /invalid/)
console.log('tavern-embedding-telemetry=ok')
