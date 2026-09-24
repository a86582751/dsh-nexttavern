/** Transactional fixed-directory preparation; pnpm graph activation is deliberately separate. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath, pathToFileURL} from 'node:url'
import {spawnSync} from 'node:child_process'
import {after, test} from 'node:test'
import {createTestDirectory, cleanupTestDirectory} from '../src/operations/test-temp.mts'
import {applyTransaction, rollbackTransaction, digest} from '../lib/operations/public-transaction.mjs'

const require = createRequire(new URL('../build-tools/package.json', import.meta.url))
const temporary = createTestDirectory('protected-packages-')
after(() => cleanupTestDirectory(temporary))
const compiled = path.join(temporary, 'protected-packages.mjs')
await require('esbuild').build({entryPoints: [fileURLToPath(new URL('../src/operations/protected-packages.mts', import.meta.url))],
  outfile: compiled, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent'})
const {planProtectedPackages, prepareProtectedPackages, protectedGeneration, recoverProtectedPackages,
  readPreparedProfile, durableReferencesIntact} = await import(pathToFileURL(compiled).href) as {
    planProtectedPackages(options: object): {changes: {path: string}[]; receipt: {clientClaims: string[]}
      clientClaims: {names: string[]; state: string; detail?: string}}
    prepareProtectedPackages(options: object): {receipt: {clientClaims: string[]; packages: {directory: string}[]}
      clientClaims: {names: string[]; state: string; detail?: string}}
    protectedGeneration(input: object): string
    recoverProtectedPackages(home: string): {state: string} | null
    readPreparedProfile(home: string, profile: string): {references: Map<string, unknown>; clientClaims: string[]} | null
    durableReferencesIntact(home: string, profile: string, references: Iterable<unknown>,
      clientClaims: readonly string[]): boolean}
const yaml = require('yaml') as {parse(text: string): unknown[]}
const include = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis-plugin-include')).href) as
  {applyEntryPatches(data: unknown[], patches: unknown[] | undefined, warn: (message: string) => void): {id: string}[]}
const write = (file: string, value: unknown) => {
  fs.mkdirSync(path.dirname(file), {recursive: true})
  fs.writeFileSync(file, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
}
function fixture(name: string) {
  const root = path.join(temporary, name)
  const home = path.join(root, 'home')
  const manifest = path.join(home, 'profiles/web/package.json')
  const lock = path.join(home, 'profiles/web/pnpm-lock.yaml')
  write(manifest, {name: 'user-profile', dependencies: {'dsh-plugin-anydoc': '1.0.0', 'user-skin': '^2.0.0'},
    dsh: {profile: {bundles: ['user-skin']}}, custom: {keep: true}})
  write(lock, 'fixture-existing-lock\n')
  return {root, home, manifest, lock, backup: path.join(root, 'backup'), profile: 'web'}
}
function source(root: string, name = 'dsh-nexttavern-anydoc', version = '1.0.0') {
  const source = path.join(root, 'source', name, version)
  write(path.join(source, 'package.json'), {name, version, type: 'module', main: 'index.js'})
  write(path.join(source, 'index.js'), `export const version = ${JSON.stringify(version)}\n`)
  const files = ['package.json', 'index.js'].map(file => ({path: file, sha256: digest(fs.readFileSync(path.join(source, file)))}))
  return {name, version, source, files}
}
const json = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8'))

test('preparation writes versioned payloads and owned refs, preserving user state and requiring relink', () => {
  const f = fixture('initial')
  const original = json(f.manifest)
  const beforeLock = fs.readFileSync(f.lock)
  const packages = [source(f.root), source(f.root, 'dsh-nexttavern-pi-ai')]
  const result = prepareProtectedPackages({...f, packages})
  assert.equal(result.state, 'references-prepared')
  assert.equal(result.requiresRelink, true, 'preparation must never claim the package-manager graph is installed')
  assert.equal(result.receipt.schemaVersion, 1)
  const manifest = json(f.manifest)
  assert.deepEqual(manifest.custom, original.custom)
  assert.deepEqual(manifest.dsh, original.dsh)
  for (const [name, spec] of Object.entries(original.dependencies)) assert.equal(manifest.dependencies[name], spec)
  for (const record of result.receipt.packages) {
    assert.equal(manifest.dependencies[record.name], record.reference)
    assert.ok(record.reference.startsWith('file:../../maintenance/fixed-packages/'))
    for (const file of record.files) assert.equal(digest(fs.readFileSync(path.join(f.home, record.directory, file.path))), file.sha256)
  }
  assert.deepEqual(fs.readFileSync(f.lock), beforeLock, 'lock is not fabricated before pnpm relinks')
  const repeated = prepareProtectedPackages({...f, packages, backup: path.join(f.root, 'unused-backup')})
  assert.equal(repeated.transaction, null)
  assert.equal(fs.existsSync(path.join(f.root, 'unused-backup')), false)
})

test('upgrade preparation rolls back references exactly and removal retains old generations and user packages', () => {
  const f = fixture('upgrade')
  const one = source(f.root)
  const first = prepareProtectedPackages({...f, packages: [one]})
  const before = fs.readFileSync(f.manifest)
  const two = source(f.root, one.name, '2.0.0')
  const backup = path.join(f.root, 'upgrade-backup')
  const second = prepareProtectedPackages({...f, packages: [two], backup})
  assert.notEqual(first.receipt.packages[0].directory, second.receipt.packages[0].directory)
  assert.ok(fs.existsSync(path.join(f.home, first.receipt.packages[0].directory, 'index.js')))
  rollbackTransaction(backup)
  assert.deepEqual(fs.readFileSync(f.manifest), before)
  const retry = prepareProtectedPackages({...f, packages: [two], backup: path.join(f.root, 'retry-backup')})
  assert.equal(retry.receipt.packages[0].version, '2.0.0', 'empty directories left by rollback allow retry')
  prepareProtectedPackages({...f, packages: [], backup: path.join(f.root, 'remove-backup')})
  assert.equal(json(f.manifest).dependencies[one.name], undefined)
  assert.equal(json(f.manifest).dependencies['dsh-plugin-anydoc'], '1.0.0')
  assert.ok(fs.existsSync(path.join(f.home, retry.receipt.packages[0].directory, 'index.js')))
})

test('unknown pins, edited managed refs, tampered payloads and incomplete source inventories fail before writes', () => {
  const f = fixture('conflicts')
  const input = source(f.root)
  const original = fs.readFileSync(f.manifest)
  write(f.manifest, {...json(f.manifest), dependencies: {...json(f.manifest).dependencies, [input.name]: '^9.0.0'}})
  assert.throws(() => planProtectedPackages({...f, packages: [input]}), /not owned/)
  fs.writeFileSync(f.manifest, original)
  write(path.join(input.source, 'unregistered.js'), 'unexpected executable')
  assert.throws(() => planProtectedPackages({...f, packages: [input]}), /inventory differs/)
  fs.unlinkSync(path.join(input.source, 'unregistered.js'))
  assert.throws(() => planProtectedPackages({...f, packages: [{...input, files: [...input.files,
    {path: 'INDEX.js', sha256: input.files[1]!.sha256}]}]}), /Duplicate/)
  assert.throws(() => planProtectedPackages({...f, packages: [{...input, files: [...input.files,
    {path: 'NUL.txt', sha256: input.files[1]!.sha256}]}]}), /portable/)
  const prepared = prepareProtectedPackages({...f, packages: [input]})
  const accepted = fs.readFileSync(f.manifest)
  write(f.manifest, {...json(f.manifest), dependencies: {...json(f.manifest).dependencies, [input.name]: 'registry-version'}})
  assert.throws(() => planProtectedPackages({...f, packages: [input]}), /reference changed/)
  fs.writeFileSync(f.manifest, accepted)
  write(path.join(f.home, prepared.receipt.packages[0].directory, 'index.js'), 'user edited')
  assert.throws(() => planProtectedPackages({...f, packages: [input]}), /hash differs/)
  assert.deepEqual(fs.readFileSync(f.manifest), accepted)
})

test('reused generations are rechecked under the home lock without rewriting them', () => {
  const f = fixture('locked-assertions')
  const input = source(f.root)
  const first = prepareProtectedPackages({...f, packages: [input]})
  const before = fs.readFileSync(f.manifest)
  const two = source(f.root, input.name, '2.0.0')
  const plan = planProtectedPackages({...f, packages: [two]})
  const existing = path.join(f.home, first.receipt.packages[0].directory, 'index.js')
  write(existing, 'changed after plan')
  assert.throws(() => applyTransaction({root: f.home, backup: path.join(f.root, 'rejected'),
    files: plan.changes, assertUnchanged() {
      assert.equal(json(path.join(f.home, '.nexttavern-transaction.lock')).pid, process.pid)
      plan.assertUnchanged()
    }}), /hash differs/)
  assert.deepEqual(fs.readFileSync(f.manifest), before)
  assert.equal(fs.readFileSync(existing, 'utf8'), 'changed after plan', 'unknown edits are never rolled back')
  assert.equal(fs.existsSync(path.join(f.home, plan.receipt.packages[0].directory, 'index.js')), false)
})

test('a caller-admitted generation is not read again, while any other record or tree still is', () => {
  const f = fixture('admitted-sources')
  const input = source(f.root)
  const admitted = [{source: fs.realpathSync(input.source), generation: protectedGeneration(input)}]
  // A member the record never named is visible only to the inventory gate, so
  // this is exactly what a repeated read catches and an admitted generation
  // does not: the durable copy is defined by the record, never by the tree.
  write(path.join(input.source, 'unregistered.js'), 'not part of the admitted generation')
  assert.throws(() => planProtectedPackages({...f, packages: [input]}), /inventory differs/)
  for (const mismatch of [
    {source: admitted[0]!.source, generation: '0'.repeat(64)},
    {source: fs.realpathSync(f.root), generation: admitted[0]!.generation},
  ]) {
    assert.throws(() => planProtectedPackages({...f, packages: [input], verifiedSources: [mismatch]}), /inventory differs/)
  }
  const plan = planProtectedPackages({...f, packages: [input], verifiedSources: admitted})
  const directory = plan.receipt.packages[0]!.directory
  assert.deepEqual(plan.changes.filter(change => change.path.startsWith(directory + '/')).map(change => change.path),
    [directory + '/index.js', directory + '/package.json'], 'the write set is the admitted record, never the tree')
  // Reuse never accepts changed bytes: the same members are still read for the
  // transaction and must match the digests this admission stands for.
  fs.appendFileSync(path.join(input.source, 'index.js'), '\n')
  assert.throws(() => planProtectedPackages({...f, packages: [input], verifiedSources: admitted}),
    /Protected source changed during planning/)
})

test('pnpm overrides and patches cannot bypass owned file references', () => {
  const f = fixture('pnpm-overrides')
  const input = source(f.root)
  prepareProtectedPackages({...f, packages: [input]})
  const accepted = json(f.manifest)
  for (const field of ['overrides', 'patchedDependencies']) {
    for (const selector of [input.name, input.name + '@1.0.0', 'parent>' + input.name + '@*']) {
      write(f.manifest, {...accepted, pnpm: {[field]: {[selector]: 'other-version'}}})
      assert.throws(() => planProtectedPackages({...f, packages: [input]}), /conflicts with pnpm/)
      assert.equal(json(f.manifest).dependencies[input.name], accepted.dependencies[input.name])
    }
  }
  write(f.manifest, {...accepted, pnpm: {overrides: {'unrelated-plugin': '2.0.0'}}})
  assert.doesNotThrow(() => planProtectedPackages({...f, packages: [input]}))
})

/**
 * A client-only owned package is a browser half this product mounts itself, so
 * the profile's patch layer has to name it: that is what a manager scanning the
 * layer reads before it mounts a second Loader source for the same bundle.
 */
test('a client-only child is claimed in the profile patch layer, once, without rewriting it', () => {
  const f = fixture('client-claim')
  const layer = path.join(f.home, 'profiles/web/cordis.patch.yml')
  const user = '# user-owned comment\n[]\n'
  write(layer, user)
  const input = {...source(f.root), client: true as const}
  const plain = source(f.root, 'dsh-nexttavern-pi-ai')
  const result = prepareProtectedPackages({...f, packages: [input, plain]})
  assert.deepEqual(result.receipt.clientClaims, [input.name])
  assert.deepEqual(result.clientClaims, {names: [input.name], state: 'declared'})
  const claimed = fs.readFileSync(layer, 'utf8')
  // The template ships a bare empty document; appending after it would leave
  // two top-level YAML nodes in one file, which no profile boots from.
  assert.ok(claimed.startsWith('# user-owned comment\n# []\n'), claimed)
  assert.ok(claimed.includes(`    - id: ${input.name}\n      disabled: true\n`), claimed)
  assert.ok(!claimed.includes(plain.name), 'a package with a host half of its own is never claimed')
  // The claim is also a real Loader row source: composed on its own it adds one
  // disabled row and warns about nothing, so it can never mount anything.
  const warnings: string[] = []
  assert.deepEqual(include.applyEntryPatches([], yaml.parse(claimed), (message) => warnings.push(message)),
    [{id: input.name, disabled: true}])
  assert.deepEqual(warnings, [])
  // Repeating the round writes nothing at all: the layer is append-only, and a
  // name it already holds stays exactly as the person wrote it.
  const repeated = planProtectedPackages({...f, packages: [input, plain]})
  assert.equal(repeated.clientClaims.state, 'current')
  assert.deepEqual(repeated.changes, [])
  assert.equal(fs.readFileSync(layer, 'utf8'), claimed)
  // The read-only decision names the claim too: a layer someone cleaned out
  // sends the profile back through the round instead of leaving it claimed
  // only in the receipt.
  const prepared = readPreparedProfile(f.home, 'web')!
  assert.deepEqual(prepared.clientClaims, [input.name])
  assert.equal(durableReferencesIntact(f.home, 'web', prepared.references.values(), prepared.clientClaims), true)
  write(layer, user)
  assert.equal(durableReferencesIntact(f.home, 'web', prepared.references.values(), prepared.clientClaims), false)
  // A profile with no patch layer at all gets exactly one.
  const bare = fixture('client-claim-no-layer')
  const bareInput = {...source(bare.root), client: true as const}
  assert.equal(fs.existsSync(path.join(bare.home, 'profiles/web/cordis.patch.yml')), false)
  assert.equal(prepareProtectedPackages({...bare, packages: [bareInput]}).clientClaims.state, 'declared')
  assert.match(fs.readFileSync(path.join(bare.home, 'profiles/web/cordis.patch.yml'), 'utf8'),
    new RegExp(`^    - id: ${bareInput.name}$`, 'mu'))
})

test('a patch layer that cannot take an appended block is reported, never rewritten', () => {
  const f = fixture('claim-refused')
  const layer = path.join(f.home, 'profiles/web/cordis.patch.yml')
  const flow = '[{id: ui-skin-nexttavern, disabled: true}]\n'
  write(layer, flow)
  const input = {...source(f.root), client: true as const}
  const result = prepareProtectedPackages({...f, packages: [input]})
  assert.equal(result.clientClaims.state, 'refused')
  assert.match(String(result.clientClaims.detail), /flow structure/)
  assert.equal(fs.readFileSync(layer, 'utf8'), flow, 'an unusable layer is left exactly as it is')
  assert.deepEqual(result.receipt.clientClaims, [input.name])
  const prepared = readPreparedProfile(f.home, 'web')!
  assert.equal(durableReferencesIntact(f.home, 'web', prepared.references.values(), prepared.clientClaims), true,
    'a layer nothing can be appended to is not a reason to run the round again')
})

test('a dead preparing owner is recoverable before a journal exists', () => {
  const f = fixture('pre-journal')
  const input = source(f.root)
  const before = fs.readFileSync(f.manifest)
  const child = path.join(f.root, 'before-journal.mjs')
  write(child, [
    `import {planProtectedPackages} from ${JSON.stringify(pathToFileURL(compiled).href)};`,
    `import {applyTransaction} from ${JSON.stringify(new URL('../lib/operations/public-transaction.mjs', import.meta.url).href)};`,
    `const plan = planProtectedPackages(${JSON.stringify({...f, packages: [input]})});`,
    `applyTransaction({root:plan.home, backup:${JSON.stringify(f.backup)}, files:plan.changes,`,
    `purpose:'prepare-protected-package-references', assertUnchanged(){process.exit(86)}});`,
  ].join('\n'))
  const result = spawnSync(process.execPath, [child], {encoding: 'utf8', timeout: 10000})
  assert.equal(result.status, 86, String(result.error ?? result.stderr))
  assert.equal(fs.existsSync(path.join(f.backup, 'transaction.json')), false)
  const lockPath = path.join(f.home, '.nexttavern-transaction.lock')
  const deadOwner = fs.readFileSync(lockPath)
  assert.equal(JSON.parse(deadOwner.toString()).schemaVersion, 1)
  assert.equal(JSON.parse(deadOwner.toString()).phase, 'preparing')
  write(lockPath, {...JSON.parse(deadOwner.toString()), pid: process.pid})
  assert.throws(() => recoverProtectedPackages(f.home), /still running/)
  fs.writeFileSync(lockPath, deadOwner)
  assert.equal(recoverProtectedPackages(f.home).state, 'rolled-back')
  assert.deepEqual(fs.readFileSync(f.manifest), before)
  assert.equal(prepareProtectedPackages({...f, packages: [input], backup: path.join(f.root, 'retry')}).requiresRelink, true)
})

test('a failed write restores metadata through the existing journal', () => {
  const f = fixture('recovery')
  const layer = path.join(f.home, 'profiles/web/cordis.patch.yml')
  write(layer, '[]\n')
  const beforeLayer = fs.readFileSync(layer)
  const input = {...source(f.root), client: true as const}
  const before = fs.readFileSync(f.manifest)
  const plan = planProtectedPackages({...f, packages: [input]})
  // Every write, so the claim the round appends is certainly in the write set
  // this rollback has to undo.
  assert.throws(() => applyTransaction({root: f.home, backup: f.backup, files: plan.changes,
    failAfter: plan.changes.length}), /Injected/)
  assert.deepEqual(fs.readFileSync(f.manifest), before)
  assert.deepEqual(fs.readFileSync(layer), beforeLayer)
})

for (const crashAfter of [1, 3, 4]) test(`discover and recover a dead installer after write ${crashAfter}`, () => {
  const f = fixture('crash-' + crashAfter)
  const original = source(f.root)
  const first = prepareProtectedPackages({...f, packages: [original]})
  const input = source(f.root, original.name, '2.0.0')
  const before = fs.readFileSync(f.manifest)
  const receiptPath = path.join(f.home, 'profiles/web/.nexttavern-protected-packages.json')
  const beforeReceipt = fs.readFileSync(receiptPath)
  const child = path.join(f.root, 'crash.mjs')
  const childBackup = path.join(f.root, 'crash-backup')
  write(child, [
    `import {planProtectedPackages} from ${JSON.stringify(pathToFileURL(compiled).href)};`,
    `import {applyTransaction} from ${JSON.stringify(new URL('../lib/operations/public-transaction.mjs', import.meta.url).href)};`,
    `const plan = planProtectedPackages(${JSON.stringify({...f, packages: [input]})});`,
    `applyTransaction({root:plan.home, backup:${JSON.stringify(childBackup)}, files:plan.changes,`,
    `purpose:'prepare-protected-package-references', assertUnchanged:plan.assertUnchanged, crashAfter:${crashAfter}});`,
  ].join('\n'))
  const result = spawnSync(process.execPath, [child], {encoding: 'utf8', timeout: 10000})
  assert.equal(result.status, 86, String(result.error ?? result.stderr))
  assert.throws(() => prepareProtectedPackages({...f, packages: [input], backup: path.join(f.root, 'blocked')}), /Pending home transaction/)
  const lockPath = path.join(f.home, '.nexttavern-transaction.lock')
  const deadOwner = fs.readFileSync(lockPath)
  write(lockPath, {...JSON.parse(deadOwner.toString()), pid: process.pid})
  assert.throws(() => recoverProtectedPackages(f.home), /still running/)
  fs.writeFileSync(lockPath, deadOwner)
  const recovered = recoverProtectedPackages(f.home)
  assert.equal(recovered.backup, childBackup, 'recovery discovers the durable backup without replanning')
  assert.equal(recovered.state, 'rolled-back')
  assert.deepEqual(fs.readFileSync(f.manifest), before)
  assert.deepEqual(fs.readFileSync(receiptPath), beforeReceipt)
  assert.equal(fs.existsSync(path.join(f.home, first.receipt.packages[0].directory, 'index.js')), true)
  assert.equal(recoverProtectedPackages(f.home), null)
  assert.equal(prepareProtectedPackages({...f, packages: [input], backup: path.join(f.root, 'final-backup')}).requiresRelink, true)
})
