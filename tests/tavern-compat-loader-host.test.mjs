import assert from 'node:assert/strict'
import {test} from 'node:test'
import {probeSyntheticLoad, syntheticModuleHash, SYNTHETIC_LOADER_LIMITS} from './tavern-compat-loader-host.mjs'

const moduleOf = source => ({source, sha256: syntheticModuleHash(source)})

test('synthetic fallback records failed attempt, winner, export, initialization and write', async () => {
  const modules = {
    'synthetic:first': moduleOf('throw Error("unavailable"); export const dialect = "first";'),
    'synthetic:second': moduleOf('initialize("second"); writeState("ready"); export const dialect = "v2";'),
  }
  const result = await probeSyntheticLoad({candidates: ['synthetic:first', 'synthetic:second'], modules})
  assert.equal(result.ok, true)
  assert.equal(result.winner, 'synthetic:second')
  assert.equal(result.dialect, 'v2')
  assert.deepEqual(result.attempts.map(item => [item.candidate, item.ok]),
    [['synthetic:first', false], ['synthetic:second', true]])
  assert.deepEqual(result.attempts[1].log, [
    {kind: 'import', value: 'synthetic:second'},
    {kind: 'initialize', value: 'second'},
    {kind: 'write', value: 'ready'},
  ])
})

test('hash mismatch and non-allowlisted import fail closed', async () => {
  const modules = {'synthetic:one': {...moduleOf('export const dialect = "ok";'), sha256: '0'.repeat(64)}}
  const mismatch = await probeSyntheticLoad({candidates: ['synthetic:one'], modules})
  assert.equal(mismatch.ok, false)
  assert.equal(mismatch.attempts[0].log[0].kind, 'import')
  assert.equal((await probeSyntheticLoad({candidates: ['node:fs'], modules})).reason, 'module-denied')
})

test('guest cannot reach Node globals or an unlisted transitive module', async () => {
  const absent = moduleOf('export const dialect = [typeof process, typeof require, typeof fetch, typeof WebSocket].join(",");')
  const globals = await probeSyntheticLoad({candidates: ['synthetic:globals'],
    modules: {'synthetic:globals': absent}})
  assert.equal(globals.dialect, 'undefined,undefined,undefined,undefined')
  const nested = moduleOf('import "node:fs"; export const dialect = "unsafe";')
  const denied = await probeSyntheticLoad({candidates: ['synthetic:nested'],
    modules: {'synthetic:nested': nested}})
  assert.equal(denied.ok, false)
  assert.equal(denied.reason, 'no-candidate-loaded')
  assert.ok(denied.attempts[0].log.some(item => item.kind === 'import' && item.value === 'node:fs'))
})

test('source and execution budgets reject without host access', async () => {
  const tooLong = moduleOf('a'.repeat(SYNTHETIC_LOADER_LIMITS.sourceChars + 1))
  assert.equal((await probeSyntheticLoad({candidates: ['synthetic:long'],
    modules: {'synthetic:long': tooLong}})).reason, 'input-limit')
  const spin = moduleOf('while (true) {} export const dialect = "never";')
  const result = await probeSyntheticLoad({candidates: ['synthetic:spin'],
    modules: {'synthetic:spin': spin}})
  assert.equal(result.ok, false)
  assert.ok(['vm-timeout', 'hard-timeout'].includes(result.reason), result.reason)
})
