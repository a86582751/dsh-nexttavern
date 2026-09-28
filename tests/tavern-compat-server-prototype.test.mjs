// P0 server prototype: the same Node host that assembles an Agent request can
// evaluate author EJS/schema without a browser or exposing Node objects.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {evaluateTavernPrototype,TAVERN_TEMPLATE_LIMITS} from './tavern-compat-server-evaluator.mjs'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/tavern-compat-contract-v1.json', import.meta.url), 'utf8'))
const digest = value => createHash('sha256').update(value).digest('hex')
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value)
assert.equal(fixture.schemaVersion, 1)
assert.equal(fixture.hashPolicy.schemaVersion, 1)
assert.equal(fixture.ownership.schemaVersion, 1)
assert.equal(fixture.ownership.cardPackage.activation, 'existing-import-transaction')
assert.equal(fixture.ownership.state.commit, 'canonical-assistant-finalize')
assert.equal(fixture.ownership.state.globalNamespace, 'player+card-package')
assert.equal(fixture.ownership.state.crossPlayerOrPackage, false)
assert.equal(fixture.ownership.promptPlan.input, 'frozen-turn-attempt')
assert.equal(fixture.ownership.frameMessage.onWorldlineChange, 'revoke-old-epoch')
const {packageSha256, ...packageBody} = fixture.cardPackage
assert.equal(fixture.cardPackage.sourceSha256, digest(fixture.sourceUtf8))
assert.equal(packageSha256, digest(canonical(packageBody)))
assert.equal(fixture.cardPackage.greetings[0].sourceSha256, digest(fixture.cardPackage.greetings[0].text))
assert.equal(fixture.stateSnapshot.packageSha256, packageSha256)
assert.equal(fixture.stateSnapshot.valueSha256, digest(canonical(fixture.stateSnapshot.scopes)))
assert.equal(fixture.promptPlan.items[0].contentSha256, digest(fixture.cardPackage.lore[0].content))
const promptPreimage = Object.fromEntries(fixture.hashPolicy.promptPreimageFields
  .map(field => [field, fixture.promptPlan[field]]))
assert.equal(fixture.promptPlan.inputSha256, digest(canonical(promptPreimage)))
assert.equal(fixture.frameMessage.packageSha256, packageSha256)
assert.equal(fixture.statePatch.expectedRevision, fixture.stateSnapshot.revision)
assert.equal(fixture.frameMessage.worldlineId, fixture.stateSnapshot.worldlineId)

const snapshot = {variables: fixture.stateSnapshot.scopes.chat,
  worldbook: {camp: fixture.cardPackage.greetings[0].text}}
const assembly = {sections: [{name: 'identity', text: 'native'}]}
const rendered = await evaluateTavernPrototype({kind: 'ejs', source: '<%= getvar("hp") %> <% activateWI("camp") %><%= getwi("camp") %>', snapshot})
assert.deepEqual(rendered, {ok: true, value: {text: '7 A quiet camp.', activations: ['camp']}})
assembly.sections.push({name: 'tavern:prototype', text: rendered.value.text})
assert.equal(assembly.sections[1].text, '7 A quiet camp.')
assert.equal(typeof window, 'undefined', 'server assembly must not depend on a browser')

const schema = await evaluateTavernPrototype({kind: 'schema', source: '({valid: typeof getvar("hp") === "number", derived: getvar("hp") + 1})', snapshot})
assert.deepEqual(schema, {ok: true, value: {proposal: {valid: true, derived: 8}, activations: []}})
const globals = await evaluateTavernPrototype({kind: 'schema',
  source: '({process: typeof process, require: typeof require, fetch: typeof fetch, WebSocket: typeof WebSocket})',
  snapshot})
assert.deepEqual(globals.value.proposal, {process: 'undefined', require: 'undefined', fetch: 'undefined', WebSocket: 'undefined'})
const escape = await evaluateTavernPrototype({kind: 'schema', source: 'process.env', snapshot})
assert.equal(escape.ok, false)
const forged = await evaluateTavernPrototype({kind: 'ejs',
  source: '<% JSON.stringify = () => "forged"; try { activations.push("camp") } catch {} %>safe', snapshot})
assert.deepEqual(forged, {ok: true, value: {text: 'safe', activations: []}},
  'guest code cannot forge the host-owned activation log or result envelope')
const loop = await evaluateTavernPrototype({kind: 'ejs', source: '<% while (true) {} %>', snapshot})
assert.equal(loop.ok, false, 'an infinite template must stop before assembly continues')
const memory = await evaluateTavernPrototype({kind: 'ejs',
  source: '<% new ArrayBuffer(20 * 1024 * 1024) %>ok', snapshot})
assert.equal(memory.ok, false, 'VM memory exhaustion must reject the template')
assert.notEqual(memory.reason, 'hard-timeout', 'the VM budget should reject allocation before the parent deadline')
const output = await evaluateTavernPrototype({kind: 'ejs', source: '<%= "x".repeat(100000) %>', snapshot})
assert.equal(output.reason, 'output-limit')
assert.deepEqual(output.diagnostic, {schemaVersion: 1, reason: 'output-limit', limit: 'outputChars',
  observed: output.diagnostic.observed, allowed: TAVERN_TEMPLATE_LIMITS.outputChars})
assert.ok(output.diagnostic.observed > output.diagnostic.allowed)
const sourceLimit = await evaluateTavernPrototype({kind: 'ejs', source: 'x'.repeat(16_385), snapshot})
assert.deepEqual(sourceLimit, {ok: false, reason: 'input-limit', diagnostic: {schemaVersion: 1,
  reason: 'input-limit', limit: 'sourceChars', observed: 16_385, allowed: 16_384}})
console.log('tavern server isolation prototype=ok (EJS, schema, no Node globals, hard stop, budgets)')
